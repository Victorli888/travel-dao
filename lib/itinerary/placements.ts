import "server-only";
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { NotFoundError } from "@/lib/api/errors";
import { getDb } from "@/lib/db";
import {
  activities,
  dayItineraries,
  dayItineraryActivities,
  trips,
} from "@/lib/db/schema";
import { withPgErrors } from "./pg-errors";
import {
  PositionSchema,
  ReorderSchema,
  UuidSchema,
  parseInput,
} from "./schemas";
import type { Placement } from "./types";

/**
 * Which activity sits on which day, and in what order. Many-to-many: a
 * two-day park ticket is one activity and two placement rows. `position`
 * lives here because ordering belongs to the pairing, and NULL means
 * unordered, not first.
 *
 * These are hand-written statements because `day_itinerary_activities` has
 * two independent FKs and **no composite key carrying `trip_id`** — nothing
 * in the database stops pairing one trip's day with another's activity
 * (`sql/validate-itinerary.sql` check 9). Until a migration closes that, the
 * JOIN below is the enforcement, and ownership, same-trip and the write are
 * one statement. Zero rows back means missing, not yours, or a different
 * trip — indistinguishable on purpose.
 */

const NOT_FOUND =
  "That day or activity does not exist, or they belong to different trips.";
const PLACEMENT_NOT_FOUND = "That activity is not on that day.";
const ALREADY_THERE = "That activity is already on that day.";

/**
 * Guarded `INSERT ... SELECT`, then reads the row back through the builder.
 *
 * The second trip buys type honesty: neon-http disables Postgres' timestamp
 * parsers and relies on Drizzle's column mappers, which do not run for
 * `db.execute` — so a `created_at` from `RETURNING` would be a string
 * wearing a `Date`. The write is still one statement.
 */
async function insertPlacement(statement: SQL): Promise<Placement> {
  const db = getDb();
  const inserted = await db.execute<{ id: string }>(statement);
  const id = inserted.rows[0]?.id;
  if (!id) throw new NotFoundError(NOT_FOUND);

  const [row] = await db
    .select()
    .from(dayItineraryActivities)
    .where(eq(dayItineraryActivities.id, id))
    .limit(1);
  return row;
}

/** Proves ownership and same-trip in one join. */
function guardedSource(
  userEmail: string,
  dayId: string,
  activityId: string,
  position: SQL,
): SQL {
  return sql`
    select d.id, a.id, ${position}
      from ${dayItineraries} d
      join ${trips} t on t.id = d.trip_id and t.user_email = ${userEmail}
      join ${activities} a on a.trip_id = t.id and a.id = ${activityId}::uuid
     where d.id = ${dayId}::uuid
  `;
}

/** `EXISTS` form of the same check, for updates and deletes. */
function ownsPlacedDay(userEmail: string) {
  return sql`exists (
    select 1
      from ${dayItineraries} d
      join ${trips} t on t.id = d.trip_id
     where d.id = ${dayItineraryActivities.dayId}
       and t.user_email = ${userEmail}
  )`;
}

/**
 * Appends to the end of a day. Idempotent: an already-placed activity keeps
 * its position. The self-write on conflict is load-bearing — `DO NOTHING`
 * returns zero rows, which this layer reads as "no such day".
 */
export async function appendActivityToDay(
  userEmail: string,
  dayId: string,
  activityId: string,
): Promise<Placement> {
  const day = parseInput(UuidSchema, dayId);
  const activity = parseInput(UuidSchema, activityId);

  const nextPosition = sql`(
    select coalesce(max(p.position), 0) + 1
      from ${dayItineraryActivities} p
     where p.day_id = d.id
  )`;

  return insertPlacement(sql`
    insert into ${dayItineraryActivities} (day_id, activity_id, position)
    ${guardedSource(userEmail, day, activity, nextPosition)}
    on conflict (day_id, activity_id)
      do update set position = ${dayItineraryActivities}.position
    returning id
  `);
}

/**
 * Places at an explicit position, or none (`null` = unordered). Calling it
 * again repositions rather than failing — the opposite of `append`.
 */
export async function placeActivityOnDay(
  userEmail: string,
  dayId: string,
  activityId: string,
  position: unknown = null,
): Promise<Placement> {
  const day = parseInput(UuidSchema, dayId);
  const activity = parseInput(UuidSchema, activityId);
  const at = parseInput(PositionSchema, position);

  return insertPlacement(sql`
    insert into ${dayItineraryActivities} (day_id, activity_id, position)
    ${guardedSource(userEmail, day, activity, sql`${at}::int`)}
    on conflict (day_id, activity_id)
      do update set position = excluded.position
    returning id
  `);
}

/**
 * Moves a placement between days, keeping its position. The `EXISTS` is the
 * insert's guard expressed for an update.
 *
 * The one function that can hit a real unique violation — the activity is
 * already on the destination day — which is a 409, not a 500.
 */
export async function moveActivityToDay(
  userEmail: string,
  fromDayId: string,
  toDayId: string,
  activityId: string,
): Promise<Placement> {
  const from = parseInput(UuidSchema, fromDayId);
  const to = parseInput(UuidSchema, toDayId);
  const activity = parseInput(UuidSchema, activityId);

  const destinationIsValid = sql`exists (
    select 1
      from ${dayItineraries} d
      join ${trips} t on t.id = d.trip_id and t.user_email = ${userEmail}
      join ${activities} a on a.trip_id = t.id and a.id = ${activity}::uuid
     where d.id = ${to}::uuid
  )`;

  const [row] = await withPgErrors(
    () =>
      getDb()
        .update(dayItineraryActivities)
        .set({ dayId: to })
        .where(
          and(
            eq(dayItineraryActivities.dayId, from),
            eq(dayItineraryActivities.activityId, activity),
            ownsPlacedDay(userEmail),
            destinationIsValid,
          ),
        )
        .returning(),
    { conflict: ALREADY_THERE },
  );

  if (!row) throw new NotFoundError(NOT_FOUND);
  return row;
}

/** Takes an activity off a day. The activity itself is untouched. */
export async function unplaceActivity(
  userEmail: string,
  dayId: string,
  activityId: string,
): Promise<void> {
  const day = parseInput(UuidSchema, dayId);
  const activity = parseInput(UuidSchema, activityId);

  const deleted = await getDb()
    .delete(dayItineraryActivities)
    .where(
      and(
        eq(dayItineraryActivities.dayId, day),
        eq(dayItineraryActivities.activityId, activity),
        ownsPlacedDay(userEmail),
      ),
    )
    .returning({ id: dayItineraryActivities.id });

  if (deleted.length === 0) throw new NotFoundError(PLACEMENT_NOT_FOUND);
}

/**
 * Renumbers from 1 in the order given, as one `UPDATE ... CASE` — a loop of
 * N updates could half-fail and leave two rows at position 3.
 *
 * Ids not in the list keep their position, so send the whole day. At a
 * handful of rows per day this beats fractional indexing.
 */
export async function reorderDay(
  userEmail: string,
  dayId: string,
  orderedActivityIds: unknown,
): Promise<Placement[]> {
  const day = parseInput(UuidSchema, dayId);
  const ordered = parseInput(ReorderSchema, orderedActivityIds);

  const cases = sql.join(
    ordered.map((id, index) => sql`when ${id}::uuid then ${index + 1}::int`),
    sql` `,
  );

  return getDb()
    .update(dayItineraryActivities)
    .set({
      position: sql`case ${dayItineraryActivities.activityId} ${cases} else ${dayItineraryActivities.position} end`,
    })
    .where(
      and(
        eq(dayItineraryActivities.dayId, day),
        inArray(dayItineraryActivities.activityId, ordered),
        ownsPlacedDay(userEmail),
      ),
    )
    .returning();
}

/** Every placement on a day, ordered. */
export async function listPlacements(
  userEmail: string,
  dayId: string,
): Promise<Placement[]> {
  const day = parseInput(UuidSchema, dayId);
  return getDb()
    .select()
    .from(dayItineraryActivities)
    .where(
      and(eq(dayItineraryActivities.dayId, day), ownsPlacedDay(userEmail)),
    )
    .orderBy(
      sql`${dayItineraryActivities.position} asc nulls last`,
      asc(dayItineraryActivities.createdAt),
    );
}
