import { describe, expect, it } from "vitest";
import {
  groupDays,
  placedActivityIds,
  toActivity,
  type ItineraryJoinRow,
} from "./shape";
import type { ActivityRow, Day } from "./types";

/**
 * The transform from flat join rows to a nested document is where an
 * invariant goes missing quietly, so the fixture below carries all four
 * awkward cases at once: an ordinary day, an empty day, an unordered
 * placement, and numeric columns arriving as strings.
 */

const CREATED = new Date("2026-08-01T00:00:00Z");

function day(id: string, date: string): Day {
  return { id, tripId: "trip-1", date, name: null, createdAt: CREATED };
}

function activity(id: string, name: string, over: Partial<ActivityRow> = {}) {
  return {
    id,
    userEmail: "traveller@example.com",
    tripId: "trip-1",
    name,
    summary: `About ${name}`,
    address: null,
    area: null,
    lat: null,
    lng: null,
    hoursOperation: null,
    source: "manual",
    sourceMetadata: null,
    durationMinutes: null,
    priorityScore: null,
    createdAt: CREATED,
    ...over,
  } satisfies ActivityRow;
}

const APRIL_1 = day("day-1", "2026-04-01");
const APRIL_2 = day("day-2", "2026-04-02");

describe("groupDays", () => {
  it("groups activities under their day, in position order", () => {
    const days = groupDays([
      { day: APRIL_1, position: 2, activity: activity("a-2", "Senso-ji") },
      { day: APRIL_1, position: 1, activity: activity("a-1", "teamLab") },
    ]);

    expect(days).toHaveLength(1);
    expect(days[0].activities.map((a) => a.name)).toEqual([
      "teamLab",
      "Senso-ji",
    ]);
  });

  it("keeps a day with nothing planned, with an empty activity list", () => {
    // The case an INNER JOIN eats. A dropped day reads to a user as data loss.
    const days = groupDays([
      { day: APRIL_1, position: 1, activity: activity("a-1", "teamLab") },
      { day: APRIL_2, position: null, activity: null },
    ]);

    expect(days.map((d) => d.date)).toEqual(["2026-04-01", "2026-04-02"]);
    expect(days[1].activities).toEqual([]);
  });

  it("sorts a null position last, not first", () => {
    // NULL means unordered, never 'before position 1'.
    const days = groupDays([
      { day: APRIL_1, position: null, activity: activity("a-0", "Unsorted") },
      { day: APRIL_1, position: 1, activity: activity("a-1", "First") },
      { day: APRIL_1, position: 2, activity: activity("a-2", "Second") },
    ]);

    expect(days[0].activities.map((a) => a.name)).toEqual([
      "First",
      "Second",
      "Unsorted",
    ]);
  });

  it("carries the position from the placement, not the activity", () => {
    const shared = activity("a-1", "DisneySea");
    const days = groupDays([
      { day: APRIL_1, position: 1, activity: shared },
      { day: APRIL_2, position: 3, activity: shared },
    ]);

    // One activity, two days, two different positions.
    expect(days[0].activities[0].position).toBe(1);
    expect(days[1].activities[0].position).toBe(3);
    expect(days[0].activities[0].id).toBe(days[1].activities[0].id);
  });

  it("returns nothing for no rows", () => {
    expect(groupDays([] as ItineraryJoinRow[])).toEqual([]);
  });
});

describe("placedActivityIds", () => {
  it("collects the activities that are on a day", () => {
    const ids = placedActivityIds([
      { day: APRIL_1, position: 1, activity: activity("a-1", "teamLab") },
      { day: APRIL_2, position: 1, activity: activity("a-2", "Senso-ji") },
    ]);

    expect([...ids].sort()).toEqual(["a-1", "a-2"]);
  });

  it("counts an activity on two days once", () => {
    const shared = activity("a-1", "DisneySea");
    const ids = placedActivityIds([
      { day: APRIL_1, position: 1, activity: shared },
      { day: APRIL_2, position: 1, activity: shared },
    ]);

    expect(ids.size).toBe(1);
  });

  it("ignores empty days, so their absence never marks anything placed", () => {
    // The complement of this set is the unassigned list, so a false positive
    // here would hide an activity from the only view that shows it.
    const ids = placedActivityIds([
      { day: APRIL_1, position: null, activity: null },
    ]);

    expect(ids.size).toBe(0);
  });
});

describe("toActivity", () => {
  it("parses numeric lat/lng out of their strings", () => {
    // `numeric` does not fit in a float64, so Postgres sends it as text.
    const parsed = toActivity(
      activity("a-1", "teamLab", { lat: "35.629000", lng: "139.786000" }),
    );

    expect(parsed.lat).toBe(35.629);
    expect(parsed.lng).toBe(139.786);
  });

  it("leaves a missing coordinate null rather than 0", () => {
    const parsed = toActivity(activity("a-1", "teamLab"));
    expect(parsed.lat).toBeNull();
    expect(parsed.lng).toBeNull();
  });
});
