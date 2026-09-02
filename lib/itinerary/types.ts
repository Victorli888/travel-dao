/**
 * Row and DTO types. Types only — erased at compile time, so no
 * `server-only` marker and safe to import anywhere.
 */
import type {
  activities,
  dayItineraries,
  dayItineraryActivities,
  trips,
} from "@/lib/db/schema";

export type TripRow = typeof trips.$inferSelect;
export type DayRow = typeof dayItineraries.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
export type PlacementRow = typeof dayItineraryActivities.$inferSelect;

/** `startDate`/`endDate` are ISO `YYYY-MM-DD`. */
export type Trip = TripRow;

export type Day = DayRow;

/** `position` NULL means *unordered*, not first. */
export type Placement = PlacementRow;

/**
 * `lat`/`lng` are `numeric(9,6)`, which Drizzle hands back as strings.
 * `shape.ts` parses them so callers never add two together.
 */
export type Activity = Omit<ActivityRow, "lat" | "lng"> & {
  lat: number | null;
  lng: number | null;
};

/** Ordering belongs to the pairing, not the activity. */
export type PlacedActivity = Activity & {
  /** NULL = unordered, not first. Sorts last. */
  position: number | null;
};

/** `activities` is empty when nothing is planned — the day still exists. */
export type DayWithActivities = Day & { activities: PlacedActivity[] };

/**
 * `unscheduled` is the only place an activity on no day surfaces: the day
 * join cannot see one. A designed state, never an error.
 */
export type Itinerary = {
  trip: Trip;
  days: DayWithActivities[];
  unscheduled: Activity[];
};
