/**
 * Flat join rows → nested document. Pure: no database import, no
 * `server-only`, so the grouping rules are unit-testable.
 */
import type {
  Activity,
  ActivityRow,
  Day,
  DayWithActivities,
  PlacedActivity,
} from "./types";

/** One row of the day → placement → activity join. Both hops are LEFT. */
export type ItineraryJoinRow = {
  day: Day;
  /** From the placement, not the activity. NULL = unordered. */
  position: number | null;
  /** NULL when the day has nothing placed on it. */
  activity: ActivityRow | null;
};

/** `numeric` arrives as a string — it does not fit in a float64. */
function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Row → DTO. The two numeric columns are the only difference. */
export function toActivity(row: ActivityRow): Activity {
  return { ...row, lat: toNumber(row.lat), lng: toNumber(row.lng) };
}

/**
 * Activities on at least one of the given days. Its complement over the
 * trip's activities is the unassigned list, so both halves come from one
 * snapshot rather than a second query a placement could race.
 *
 * Scoped to the days passed in, so it means *assigned on this trip*.
 */
export function placedActivityIds(rows: ItineraryJoinRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.activity) ids.add(row.activity.id);
  }
  return ids;
}

/** NULLS LAST, then ascending. Ties keep their incoming order. */
function byPosition(a: PlacedActivity, b: PlacedActivity): number {
  if (a.position === b.position) return 0;
  if (a.position === null) return 1;
  if (b.position === null) return -1;
  return a.position - b.position;
}

/**
 * Groups rows into days, first-seen order (the query sorts by date).
 *
 * A row with a null activity yields an empty day, never a null entry — the
 * case an INNER JOIN would have eaten. Sorting here as well as in SQL keeps
 * the function correct on its own terms.
 */
export function groupDays(rows: ItineraryJoinRow[]): DayWithActivities[] {
  const days = new Map<string, DayWithActivities>();

  for (const row of rows) {
    let day = days.get(row.day.id);
    if (!day) {
      day = { ...row.day, activities: [] };
      days.set(row.day.id, day);
    }
    if (row.activity) {
      day.activities.push({
        ...toActivity(row.activity),
        position: row.position,
      });
    }
  }

  for (const day of days.values()) day.activities.sort(byPosition);

  return [...days.values()];
}
