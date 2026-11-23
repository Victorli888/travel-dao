import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatPriority,
  stepDay,
  summarizePlan,
  toPlanDays,
  toPlanStop,
  toggleId,
} from "./day-plan";
import type { DayWithActivities, PlacedActivity } from "./types";

function activity(overrides: Partial<PlacedActivity> = {}): PlacedActivity {
  return {
    id: "a1",
    userEmail: "me@example.com",
    tripId: "t1",
    name: "Fushimi Inari",
    summary: "Ten thousand torii.",
    address: null,
    area: null,
    lat: null,
    lng: null,
    hoursOperation: null,
    source: "manual",
    sourceMetadata: null,
    durationMinutes: null,
    priorityScore: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    country: null,
    activityType: null,
    position: null,
    ...overrides,
  };
}

function day(overrides: Partial<DayWithActivities> = {}): DayWithActivities {
  return {
    id: "d1",
    tripId: "t1",
    date: "2026-04-14",
    name: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    activities: [],
    ...overrides,
  };
}

describe("formatDuration", () => {
  it("treats null, zero and negatives as unknown", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(-5)).toBeNull();
  });

  it("formats minutes, hours, and both", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(90)).toBe("1 h 30 min");
  });
});

describe("formatPriority", () => {
  it("keeps NULL as not prioritised rather than lowest", () => {
    expect(formatPriority(null)).toBeNull();
  });

  it("names the ends of the scale", () => {
    expect(formatPriority(5)).toBe("Must-do");
    expect(formatPriority(1)).toBe("Maybe");
    expect(formatPriority(3)).toBe("Priority 3 of 5");
  });
});

describe("toPlanStop", () => {
  it("lists only the fields that are recorded", () => {
    const stop = toPlanStop(activity({ priorityScore: 4, hoursOperation: "9–5" }));
    expect(stop.details).toEqual([{ label: "Hours", value: "9–5" }]);
    expect(stop.priorityLabel).toBe("Priority 4 of 5");
    expect(stop.area).toBeNull();
    expect(stop.mapHref).toBeNull();
  });

  it("carries every recorded detail, in a fixed order", () => {
    const stop = toPlanStop(
      activity({
        address: "68 Fukakusa",
        hoursOperation: "Always open",
        durationMinutes: 150,
        priorityScore: 5,
        activityType: "Shrine",
        country: "Japan",
        area: "  Fushimi ",
        lat: 34.9671,
        lng: 135.7727,
      }),
    );
    expect(stop.details.map((d) => d.label)).toEqual([
      "Address",
      "Hours",
      "Time needed",
      "Type",
      "Country",
    ]);
    expect(stop.duration).toBe("2 h 30 min");
    expect(stop.area).toBe("Fushimi");
    expect(stop.mapHref).toContain("query=34.9671,135.7727");
  });

  it("treats a blank summary as absent", () => {
    expect(toPlanStop(activity({ summary: "   " })).summary).toBeNull();
  });

  it("needs both coordinates for a map link", () => {
    expect(toPlanStop(activity({ lat: 34.9, lng: null })).mapHref).toBeNull();
  });
});

describe("toPlanDays", () => {
  it("numbers days and falls back to the date when unnamed", () => {
    const [first, second] = toPlanDays([
      day(),
      day({ id: "d2", date: "2026-04-15", name: "Temple day" }),
    ]);
    expect(first).toMatchObject({ number: 1, title: "Tue 14 Apr", dateLabel: null });
    expect(second).toMatchObject({
      number: 2,
      title: "Temple day",
      dateLabel: "Wed 15 Apr",
      spokenDate: "Wednesday, 15 April 2026",
      kicker: "Wednesday · 15 April",
      heading: "Temple day",
    });
  });

  it("keeps the incoming activity order and an empty day empty", () => {
    const [planned, empty] = toPlanDays([
      day({
        activities: [
          activity({ id: "x", position: 1 }),
          activity({ id: "y", position: null }),
        ],
      }),
      day({ id: "d2", date: "2026-04-15" }),
    ]);
    expect(planned.stops.map((s) => s.id)).toEqual(["x", "y"]);
    expect(empty.stops).toEqual([]);
  });
});

describe("stepDay", () => {
  it("moves within bounds and stops at either end", () => {
    expect(stepDay(1, 1, 3)).toBe(2);
    expect(stepDay(1, -1, 3)).toBe(0);
    expect(stepDay(0, -1, 3)).toBeNull();
    expect(stepDay(2, 1, 3)).toBeNull();
  });
});

describe("toggleId", () => {
  it("expands and collapses without mutating the original", () => {
    const start = new Set<string>();
    const opened = toggleId(start, "a");
    expect(opened.has("a")).toBe(true);
    expect(start.size).toBe(0);
    expect(toggleId(opened, "a").has("a")).toBe(false);
  });
});

describe("areas and summary", () => {
  it("collects distinct recorded areas per day and skips NULL", () => {
    const [d] = toPlanDays([
      day({
        activities: [
          activity({ id: "a", area: "Gion" }),
          activity({ id: "b", area: null }),
          activity({ id: "c", area: "Gion" }),
          activity({ id: "d", area: "Fushimi" }),
        ],
      }),
    ]);
    expect(d.areas).toEqual(["Gion", "Fushimi"]);
    expect(d.shortDate).toBe("Tue 14 Apr");
    expect(d).toMatchObject({ kicker: "Tuesday", heading: "14 April" });
  });

  it("totals days, stops and distinct areas across the trip", () => {
    const days = toPlanDays([
      day({ activities: [activity({ id: "a", area: "Gion" })] }),
      day({
        id: "d2",
        date: "2026-04-15",
        activities: [
          activity({ id: "a", area: "Gion" }),
          activity({ id: "b", area: "Fushimi" }),
        ],
      }),
      day({ id: "d3", date: "2026-04-16" }),
    ]);
    expect(summarizePlan(days)).toEqual({ days: 3, stops: 3, areas: 2 });
  });
});
