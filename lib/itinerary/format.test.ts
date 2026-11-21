import { describe, expect, it } from "vitest";
import { formatDateRange, formatDayLabel, formatFullDate } from "./format";

/**
 * The point of this file is the time zone. A Postgres `date` is a bare
 * `YYYY-MM-DD`, `new Date` reads it as UTC midnight, and formatting in local
 * time renders the day before for anyone west of Greenwich. These tests run
 * under `TZ` set to a western zone so a dropped `timeZone: "UTC"` fails here
 * rather than in front of a user.
 */

describe("formatDayLabel", () => {
  it("names the right weekday and day", () => {
    expect(formatDayLabel("2026-04-12")).toBe("Sun 12 Apr");
  });

  it("does not slip a day west of Greenwich", () => {
    // Would read "Sat 11 Apr" if the formatter used the local zone.
    expect(formatDayLabel("2026-04-12")).toContain("12");
  });
});

describe("formatFullDate", () => {
  it("spells the month out", () => {
    expect(formatFullDate("2026-04-12")).toBe("12 April 2026");
  });
});

describe("formatDateRange", () => {
  it("says the month and year once inside one month", () => {
    expect(formatDateRange("2026-04-12", "2026-04-19")).toBe("12–19 Apr 2026");
  });

  it("repeats the month but not the year across months", () => {
    expect(formatDateRange("2026-03-29", "2026-04-04")).toBe(
      "29 Mar – 4 Apr 2026",
    );
  });

  it("repeats both across a new year", () => {
    expect(formatDateRange("2026-12-29", "2027-01-03")).toBe(
      "29 Dec 2026 – 3 Jan 2027",
    );
  });

  it("collapses a single-day trip", () => {
    expect(formatDateRange("2026-04-12", "2026-04-12")).toBe("12 Apr 2026");
  });

  // The form requires both dates; the data layer does not, so a trip made
  // elsewhere can reach the list with one end or neither.
  it("handles a trip with no dates at all", () => {
    expect(formatDateRange(null, null)).toBe("No dates yet");
  });

  it("handles one open end", () => {
    expect(formatDateRange("2026-04-12", null)).toBe("From 12 Apr 2026");
    expect(formatDateRange(null, "2026-04-19")).toBe("Until 19 Apr 2026");
  });
});
