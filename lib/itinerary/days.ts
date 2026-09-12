import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { getDb } from "@/lib/db";
import {
  activities,
  dayItineraries,
  dayItineraryActivities,
  trips,
} from "@/lib/db/schema";
import { listActivities } from "./activities";
import { groupDays, placedActivityIds } from "./shape";
import { DateSchema, DayNameSchema, UuidSchema, parseInput } from "./schemas";
import { getTrip } from "./trips";
import type { Day, Itinerary } from "./types";

/**
 * A day is a trip and a date, nothing else. There is no geography on it —
 * where the traveller is that day comes from the activities placed on it,
 * a deliberate consequence of migration `0003`.
 */

const NOT_FOUND = "That trip does not exist.";
const DAY_NOT_FOUND = "That day does not exist.";

/** Longer than this is a typo, not a sabbatical. */
const MAX_TRIP_DAYS = 366;

const dayColumns = {
  id: dayItineraries.id,
  tripId: dayItineraries.tripId,
  date: dayItineraries.date,
  name: dayItineraries.name,
  createdAt: dayItineraries.createdAt,
};

/** Ownership as a reusable predicate. */
function ownsDay(userEmail: string) {
  return sql`exists (select 1 from ${trips} where ${trips.id} = ${dayItineraries.tripId} and ${trips.userEmail} = ${userEmail})`;
}

/** Every date from `start` to `end` inclusive, as `YYYY-MM-DD`. */
function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  // UTC throughout: a `date` column has no time zone, and local-time steps
  // skip or repeat a day across a DST boundary.
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function listDays(
  userEmail: string,
  tripId: string,
): Promise<Day[]> {
  const id = parseInput(UuidSchema, tripId);
  return getDb()
    .select(dayColumns)
    .from(dayItineraries)
    .innerJoin(
      trips,
      and(eq(trips.id, dayItineraries.tripId), eq(trips.userEmail, userEmail)),
    )
    .where(eq(dayItineraries.tripId, id))
    .orderBy(asc(dayItineraries.date));
}

/**
 * The whole plan: the trip, its days with their activities, and whatever is
 * on no day at all.
 *
 * **Both hops are LEFT JOIN** — one so an empty day still comes back, one so
 * the row survives an absent placement. An INNER JOIN silently drops every
 * empty day, which reads as data loss rather than a bug.
 *
 * `unscheduled` is derived from the same rows, so both halves always agree.
 */
export async function getItinerary(
  userEmail: string,
  tripId: string,
): Promise<Itinerary | null> {
  const trip = await getTrip(userEmail, tripId);
  if (!trip) return null;

  const db = getDb();

  // `getTrip` above settled ownership, so these scope on `tripId`.
  const rows = await db
    .select({
      day: dayColumns,
      position: dayItineraryActivities.position,
      activity: activities,
    })
    .from(dayItineraries)
    .leftJoin(
      dayItineraryActivities,
      eq(dayItineraryActivities.dayId, dayItineraries.id),
    )
    .leftJoin(activities, eq(activities.id, dayItineraryActivities.activityId))
    .where(eq(dayItineraries.tripId, trip.id))
    .orderBy(
      asc(dayItineraries.date),
      sql`${dayItineraryActivities.position} asc nulls last`,
    );

  // The complement of what the join placed — no second query to race.
  const all = await listActivities(userEmail, trip.id);
  const placed = placedActivityIds(rows);

  return {
    trip,
    days: groupDays(rows),
    unscheduled: all.filter((activity) => !placed.has(activity.id)),
  };
}

/**
 * One row per date in the trip's range. `UNIQUE (trip_id, date)` makes this a
 * plain upsert, so it stays one statement and running it twice is a no-op —
 * which matters, since the Neon HTTP driver cannot roll back a partial write.
 *
 * **It only ever adds.** Shortening a trip leaves the out-of-range days and
 * everything planned on them; removing one is `removeDay`, the user's call.
 */
export async function generateDays(
  userEmail: string,
  tripId: string,
): Promise<Day[]> {
  const trip = await getTrip(userEmail, tripId);
  if (!trip) throw new NotFoundError(NOT_FOUND);

  if (!trip.startDate || !trip.endDate) {
    // Otherwise the range is empty and the caller cannot tell why.
    throw new ValidationError(
      "Set a start and end date on the trip before generating days.",
    );
  }

  const dates = eachDate(trip.startDate, trip.endDate);
  if (dates.length > MAX_TRIP_DAYS) {
    throw new ValidationError(
      `That range covers ${dates.length} days. Check the dates.`,
    );
  }

  if (dates.length > 0) {
    await getDb()
      .insert(dayItineraries)
      .values(dates.map((date) => ({ tripId: trip.id, date })))
      .onConflictDoNothing({
        target: [dayItineraries.tripId, dayItineraries.date],
      });
  }

  return listDays(userEmail, trip.id);
}

/**
 * Adds one date, outside the trip's range if you like. Idempotent: an
 * existing date returns its day rather than failing.
 */
export async function addDay(
  userEmail: string,
  tripId: string,
  date: unknown,
): Promise<Day> {
  const day = parseInput(DateSchema, date);
  const trip = await getTrip(userEmail, tripId);
  if (!trip) throw new NotFoundError(NOT_FOUND);

  const [row] = await getDb()
    .insert(dayItineraries)
    .values({ tripId: trip.id, date: day })
    .onConflictDoUpdate({
      target: [dayItineraries.tripId, dayItineraries.date],
      // No-op write so the existing row becomes the RETURNING subject.
      set: { tripId: sql`${dayItineraries.tripId}` },
    })
    .returning(dayColumns);

  return row;
}

/**
 * Names a day, or clears the name with an explicit `null` — an unnamed day
 * falls back to its date, which is what the nullable column is for.
 *
 * One statement. `ownsDay` proves the trip is the caller's inside the
 * `WHERE`, so there is no read-then-write window and nothing to half-apply
 * on a driver that cannot roll back.
 *
 * Zero rows back means missing *or* not yours; both are `NotFoundError`,
 * since telling them apart reveals which day ids exist.
 */
export async function renameDay(
  userEmail: string,
  dayId: string,
  name: unknown,
): Promise<Day> {
  const id = parseInput(UuidSchema, dayId);
  const value = parseInput(DayNameSchema, name);

  const [row] = await getDb()
    .update(dayItineraries)
    .set({ name: value })
    .where(and(eq(dayItineraries.id, id), ownsDay(userEmail)))
    .returning(dayColumns);

  if (!row) throw new NotFoundError(DAY_NOT_FOUND);
  return row;
}

/**
 * Placements cascade away; **the activities survive**, off any day. The
 * asymmetry with `deleteTrip` is a product decision, not an oversight.
 */
export async function removeDay(
  userEmail: string,
  dayId: string,
): Promise<void> {
  const id = parseInput(UuidSchema, dayId);
  const deleted = await getDb()
    .delete(dayItineraries)
    .where(and(eq(dayItineraries.id, id), ownsDay(userEmail)))
    .returning({ id: dayItineraries.id });

  if (deleted.length === 0) throw new NotFoundError(DAY_NOT_FOUND);
}
