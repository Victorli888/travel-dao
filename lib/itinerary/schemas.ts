/**
 * Input schemas. Pure — no database import, no `server-only` marker.
 *
 * These restate the database's CHECK constraints so bad input becomes a
 * readable 400 instead of a raw constraint violation. `schemas.test.ts` is
 * what stops the two copies drifting.
 */
import { z } from "zod";
import { ValidationError } from "@/lib/api/errors";

/** Matches `trips_status_check`. */
export const TripStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "archived",
]);

/** Postgres `date` columns hold `YYYY-MM-DD` strings. */
const IsoDate = z.iso.date("Use a calendar date like 2026-04-01.");

/**
 * Matches `activities_priority_score_check`. NULL means *not yet
 * prioritised*, never "lowest" — callers sort it `NULLS LAST`.
 */
export const PriorityScoreSchema = z
  .number()
  .int("A priority is a whole number from 1 to 5.")
  .min(1, "The lowest priority is 1.")
  .max(5, "The highest priority is 5.")
  .nullable();

/** `numeric(9,6)`. Stored as a string, accepted here as a number. */
const Latitude = z.number().min(-90).max(90);
const Longitude = z.number().min(-180).max(180);

const TripName = z
  .string()
  .trim()
  .min(1, "Give the trip a name.")
  .max(200, "That trip name is too long.");

const ActivityName = z
  .string()
  .trim()
  .min(1, "Give the activity a name.")
  .max(200, "That activity name is too long.");

const DayName = z
  .string()
  .trim()
  .min(1, "Give the day a name.")
  .max(200, "That day name is too long.");

const ActivitySummary = z
  .string()
  .trim()
  .min(1, "Describe the activity in a sentence or two.")
  .max(2000, "That description is too long.");

/** The one cross-field rule; both dates must be present to check it. */
function endNotBeforeStart(v: {
  startDate?: string | null;
  endDate?: string | null;
}) {
  if (!v.startDate || !v.endDate) return true;
  return v.endDate >= v.startDate;
}

const DATE_ORDER = {
  message: "The end date cannot be before the start date.",
  path: ["endDate"],
};

export const CreateTripSchema = z
  .object({
    name: TripName,
    startDate: IsoDate.nullable().optional(),
    endDate: IsoDate.nullable().optional(),
    status: TripStatusSchema.optional(),
  })
  .refine(endNotBeforeStart, DATE_ORDER);

export type CreateTripInput = z.infer<typeof CreateTripSchema>;

/**
 * What the "create a trip" form sends. Stricter than `CreateTripSchema` on
 * purpose: the planner lays out a column per day, and it cannot do that
 * without both ends of the range, so the form demands them.
 *
 * The data layer stays permissive — a dateless trip is still a valid idea,
 * and `listTrips` sorts those last.
 */
export const CreateDatedTripSchema = z
  .object({
    name: TripName,
    startDate: IsoDate,
    endDate: IsoDate,
  })
  .refine(endNotBeforeStart, DATE_ORDER);

export type CreateDatedTripInput = z.infer<typeof CreateDatedTripSchema>;

/**
 * An absent key means *leave it alone*; an explicit `null` means *clear it*.
 * Zod v4 omits absent optional keys, which is what lets callers use `in`.
 *
 * The date rule fires only when the patch carries both dates. `updateTrip`
 * re-checks against the merged row, since patching one can invert the range.
 */
export const UpdateTripSchema = z
  .object({
    name: TripName.optional(),
    startDate: IsoDate.nullable().optional(),
    endDate: IsoDate.nullable().optional(),
    status: TripStatusSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.")
  .refine(endNotBeforeStart, DATE_ORDER);

export type UpdateTripInput = z.infer<typeof UpdateTripSchema>;

/**
 * One schema, two producers: the "add a place" form, and the research agent
 * once it persists. `summary` is required — the column is `NOT NULL`.
 */
export const ActivityDraftSchema = z.object({
  name: ActivityName,
  summary: ActivitySummary,
  address: z.string().trim().max(500).nullable().optional(),
  /** The neighbourhood, not a slice of `address`. 200 is this file's cap. */
  area: z.string().trim().max(200).nullable().optional(),
  lat: Latitude.nullable().optional(),
  lng: Longitude.nullable().optional(),
  hoursOperation: z.string().trim().max(500).nullable().optional(),
  source: z.string().trim().min(1).max(50).optional(),
  sourceMetadata: z.unknown().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  priorityScore: PriorityScoreSchema.optional(),
});

export type ActivityDraft = z.infer<typeof ActivityDraftSchema>;

export const UpdateActivitySchema = ActivityDraftSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  "Nothing to update.",
);

export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>;

export const UuidSchema = z.uuid("That is not a valid id.");

export const DateSchema = IsoDate;

/**
 * A day's label. The column is unbounded `text`, so the 200-character cap is
 * this file's call, not the database's.
 *
 * `null` means *unnamed* — the day falls back to its date — so clearing a
 * name is an explicit null. An empty string would be a second spelling of
 * the same state, which is why `.min(1)` rejects it.
 */
export const DayNameSchema = DayName.nullable();

/** A whole day's order. Ids absent from the list keep their current position. */
export const ReorderSchema = z
  .array(UuidSchema)
  .min(1, "Send at least one activity to reorder.");

/** `position` is nullable on the placement: NULL means unordered, not first. */
export const PositionSchema = z.number().int().min(1).nullable();

/**
 * Throws `ValidationError` (400) carrying the first issue's message, so no
 * caller branches on a status. Mirrors `parseResearchRequest`.
 */
export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallback = "Invalid input",
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? fallback);
  }
  return parsed.data;
}
