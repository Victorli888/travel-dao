import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { NotFoundError } from "@/lib/api/errors";
import { getDb } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { toActivity } from "./shape";
import {
  ActivityDraftSchema,
  UpdateActivitySchema,
  UuidSchema,
  parseInput,
} from "./schemas";
import { getTrip } from "./trips";
import type { Activity } from "./types";

/**
 * The places themselves. One row with one identity, placed onto N days by N
 * rows in `day_itinerary_activities` — there is deliberately no `day_id`,
 * since cloning per day would duplicate the place and every edit to it.
 *
 * Ownership checks `activities.user_email` directly rather than joining
 * `trips`: it is populated from the trip on insert and covered by
 * `idx_activities_user_trip`, so the two cannot disagree.
 *
 * Which activities are unassigned is answered by `getItinerary`, from the
 * snapshot it already has. There is no separate query for it.
 */

const NOT_FOUND = "That activity does not exist.";
const TRIP_NOT_FOUND = "That trip does not exist.";

/**
 * Must-dos first, unrated last. NULL means *not yet prioritised*, so it sorts
 * `NULLS LAST` — treating it as 0 would bury everything nobody has rated.
 */
const byPriority = [
  sql`${activities.priorityScore} desc nulls last`,
  asc(activities.createdAt),
];

/** Everything on the trip, scheduled or not. */
export async function listActivities(
  userEmail: string,
  tripId: string,
): Promise<Activity[]> {
  const id = parseInput(UuidSchema, tripId);
  const rows = await getDb()
    .select()
    .from(activities)
    .where(and(eq(activities.tripId, id), eq(activities.userEmail, userEmail)))
    .orderBy(...byPriority);
  return rows.map(toActivity);
}

export async function getActivity(
  userEmail: string,
  activityId: string,
): Promise<Activity | null> {
  const id = parseInput(UuidSchema, activityId);
  const [row] = await getDb()
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userEmail, userEmail)))
    .limit(1);
  return row ? toActivity(row) : null;
}

/**
 * Adds a place to the trip. It starts on no day; placing it is a separate
 * decision. The trip is read first so ownership cannot be bypassed.
 */
export async function addActivity(
  userEmail: string,
  tripId: string,
  input: unknown,
): Promise<Activity> {
  const draft = parseInput(ActivityDraftSchema, input);
  const trip = await getTrip(userEmail, tripId);
  if (!trip) throw new NotFoundError(TRIP_NOT_FOUND);

  const [row] = await getDb()
    .insert(activities)
    .values({
      userEmail,
      tripId: trip.id,
      name: draft.name,
      summary: draft.summary,
      address: draft.address ?? null,
      // `numeric` is a string on the wire in both directions.
      lat: draft.lat == null ? null : String(draft.lat),
      lng: draft.lng == null ? null : String(draft.lng),
      hoursOperation: draft.hoursOperation ?? null,
      sourceMetadata: draft.sourceMetadata ?? null,
      durationMinutes: draft.durationMinutes ?? null,
      priorityScore: draft.priorityScore ?? null,
      ...(draft.source ? { source: draft.source } : {}),
    })
    .returning();

  return toActivity(row);
}

/**
 * Absent key leaves a field alone; explicit `null` clears it — including
 * `priorityScore`, where `null` means *back to unrated*, not "lowest".
 */
export async function updateActivity(
  userEmail: string,
  activityId: string,
  input: unknown,
): Promise<Activity> {
  const id = parseInput(UuidSchema, activityId);
  const patch = parseInput(UpdateActivitySchema, input);

  const set: PgUpdateSetSource<typeof activities> = {};
  if ("name" in patch) set.name = patch.name;
  if ("summary" in patch) set.summary = patch.summary;
  if ("address" in patch) set.address = patch.address ?? null;
  if ("lat" in patch) set.lat = patch.lat == null ? null : String(patch.lat);
  if ("lng" in patch) set.lng = patch.lng == null ? null : String(patch.lng);
  if ("hoursOperation" in patch) {
    set.hoursOperation = patch.hoursOperation ?? null;
  }
  if ("source" in patch) set.source = patch.source;
  if ("sourceMetadata" in patch) set.sourceMetadata = patch.sourceMetadata;
  if ("durationMinutes" in patch) {
    set.durationMinutes = patch.durationMinutes ?? null;
  }
  if ("priorityScore" in patch) set.priorityScore = patch.priorityScore ?? null;

  const [row] = await getDb()
    .update(activities)
    .set(set)
    .where(and(eq(activities.id, id), eq(activities.userEmail, userEmail)))
    .returning();

  if (!row) throw new NotFoundError(NOT_FOUND);
  return toActivity(row);
}

/**
 * Deletes the activity and every placement of it. To take it off one day,
 * use `unplaceActivity`.
 */
export async function deleteActivity(
  userEmail: string,
  activityId: string,
): Promise<void> {
  const id = parseInput(UuidSchema, activityId);
  const deleted = await getDb()
    .delete(activities)
    .where(and(eq(activities.id, id), eq(activities.userEmail, userEmail)))
    .returning({ id: activities.id });

  if (deleted.length === 0) throw new NotFoundError(NOT_FOUND);
}
