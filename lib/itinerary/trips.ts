import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { getDb } from "@/lib/db";
import { trips } from "@/lib/db/schema";
import { withPgErrors } from "./pg-errors";
import {
  CreateTripSchema,
  UpdateTripSchema,
  UuidSchema,
  parseInput,
} from "./schemas";
import type { Trip } from "./types";

/**
 * `userEmail` is always in the `where`: Drizzle has no row-level security and
 * ownership is an email string, so a forgotten filter is a data leak.
 *
 * Missing and not-yours are the same `NotFoundError` — distinguishing them
 * would reveal which trip ids exist.
 */

const NOT_FOUND = "That trip does not exist.";

/** `trips_user_email_fkey` is the only email failure mode. */
const NOT_ALLOWED = "That account is not on the allow-list.";

/** Dated trips lead; undated ones are still ideas. */
export async function listTrips(userEmail: string): Promise<Trip[]> {
  return getDb()
    .select()
    .from(trips)
    .where(eq(trips.userEmail, userEmail))
    .orderBy(sql`${trips.startDate} asc nulls last`, desc(trips.createdAt));
}

export async function getTrip(
  userEmail: string,
  tripId: string,
): Promise<Trip | null> {
  const id = parseInput(UuidSchema, tripId);
  const [row] = await getDb()
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), eq(trips.userEmail, userEmail)))
    .limit(1);
  return row ?? null;
}

export async function createTrip(
  userEmail: string,
  input: unknown,
): Promise<Trip> {
  const draft = parseInput(CreateTripSchema, input);

  return withPgErrors(
    async () => {
      const [row] = await getDb()
        .insert(trips)
        .values({
          userEmail,
          name: draft.name,
          startDate: draft.startDate ?? null,
          endDate: draft.endDate ?? null,
          ...(draft.status ? { status: draft.status } : {}),
        })
        .returning();
      return row;
    },
    { foreignKey: NOT_ALLOWED },
  );
}

/**
 * Absent key leaves a field alone; explicit `null` on a date clears it.
 *
 * Reads before writing because patching `endDate` alone can invert the range
 * against a `startDate` the patch never mentions, and no CHECK catches it.
 * The write is still one statement, so there is no partial-write window.
 *
 * Touches the `trips` row only — shortening a trip does not delete the days
 * now outside its range. See `removeDay`.
 */
export async function updateTrip(
  userEmail: string,
  tripId: string,
  input: unknown,
): Promise<Trip> {
  const id = parseInput(UuidSchema, tripId);
  const patch = parseInput(UpdateTripSchema, input);

  const current = await getTrip(userEmail, id);
  if (!current) throw new NotFoundError(NOT_FOUND);

  const startDate =
    "startDate" in patch ? (patch.startDate ?? null) : current.startDate;
  const endDate = "endDate" in patch ? (patch.endDate ?? null) : current.endDate;
  if (startDate && endDate && endDate < startDate) {
    throw new ValidationError("The end date cannot be before the start date.");
  }

  // No `$onUpdate` on the column — set by hand or not at all.
  const set: PgUpdateSetSource<typeof trips> = { updatedAt: new Date() };
  if ("name" in patch) set.name = patch.name;
  if ("status" in patch) set.status = patch.status;
  if ("startDate" in patch) set.startDate = startDate;
  if ("endDate" in patch) set.endDate = endDate;

  const [row] = await getDb()
    .update(trips)
    .set(set)
    .where(and(eq(trips.id, id), eq(trips.userEmail, userEmail)))
    .returning();

  if (!row) throw new NotFoundError(NOT_FOUND);
  return row;
}

/**
 * Cascades to days, placements and **all of the trip's activities**. A
 * product decision, not a default — `removeDay` deliberately does not.
 */
export async function deleteTrip(
  userEmail: string,
  tripId: string,
): Promise<void> {
  const id = parseInput(UuidSchema, tripId);
  const deleted = await getDb()
    .delete(trips)
    .where(and(eq(trips.id, id), eq(trips.userEmail, userEmail)))
    .returning({ id: trips.id });

  if (deleted.length === 0) throw new NotFoundError(NOT_FOUND);
}
