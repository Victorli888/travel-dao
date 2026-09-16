import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/api/errors";
import {
  ActivityDraftSchema,
  CreateDatedTripSchema,
  CreateTripSchema,
  DayNameSchema,
  PriorityScoreSchema,
  UpdateTripSchema,
  parseInput,
} from "./schemas";

/**
 * These schemas restate constraints the database already enforces. The point
 * of testing them is that the two must not drift: if
 * `activities_priority_score_check` ever moves off 1-5, this file fails and
 * says so, rather than the mismatch surfacing as a 500 carrying a raw
 * constraint-violation message.
 */

const DRAFT = { name: "teamLab Planets", summary: "Immersive art museum." };

describe("PriorityScoreSchema", () => {
  // Mirrors `activities_priority_score_check`: (score >= 1) AND (score <= 5).
  it.each([1, 3, 5])("accepts %i", (score) => {
    expect(parseInput(PriorityScoreSchema, score)).toBe(score);
  });

  it("accepts null, which means unrated rather than lowest", () => {
    expect(parseInput(PriorityScoreSchema, null)).toBeNull();
  });

  it.each([0, 6, -1, 2.5])("rejects %s", (score) => {
    expect(() => parseInput(PriorityScoreSchema, score)).toThrow(
      ValidationError,
    );
  });
});

describe("CreateTripSchema", () => {
  it("accepts a name on its own — dates are optional", () => {
    const trip = parseInput(CreateTripSchema, { name: "Japan 2027" });
    expect(trip.name).toBe("Japan 2027");
  });

  it("trims the name", () => {
    expect(parseInput(CreateTripSchema, { name: "  Japan  " }).name).toBe(
      "Japan",
    );
  });

  it("rejects an empty name", () => {
    expect(() => parseInput(CreateTripSchema, { name: "   " })).toThrow(
      ValidationError,
    );
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      parseInput(CreateTripSchema, {
        name: "Japan",
        startDate: "2027-04-09",
        endDate: "2027-04-01",
      }),
    ).toThrow(ValidationError);
  });

  it("accepts a single-day trip where start and end match", () => {
    const trip = parseInput(CreateTripSchema, {
      name: "Day trip",
      startDate: "2027-04-01",
      endDate: "2027-04-01",
    });
    expect(trip.endDate).toBe("2027-04-01");
  });

  it("rejects a date that is not a calendar date", () => {
    expect(() =>
      parseInput(CreateTripSchema, { name: "Japan", startDate: "April 1st" }),
    ).toThrow(ValidationError);
  });

  it("rejects a status outside the four the CHECK allows", () => {
    expect(() =>
      parseInput(CreateTripSchema, { name: "Japan", status: "cancelled" }),
    ).toThrow(ValidationError);
  });
});

/**
 * The form's schema, not the database's. It is deliberately stricter than
 * `CreateTripSchema` — these tests are what keeps the difference on purpose
 * rather than by accident.
 */
describe("CreateDatedTripSchema", () => {
  const TRIP = {
    name: "Japan 2027",
    startDate: "2027-04-01",
    endDate: "2027-04-09",
  };

  it("accepts a name with both dates", () => {
    expect(parseInput(CreateDatedTripSchema, TRIP)).toEqual(TRIP);
  });

  it("accepts a single-day trip where start and end match", () => {
    const trip = parseInput(CreateDatedTripSchema, {
      ...TRIP,
      endDate: TRIP.startDate,
    });
    expect(trip.endDate).toBe(TRIP.startDate);
  });

  it("rejects an empty name", () => {
    expect(() => parseInput(CreateDatedTripSchema, { ...TRIP, name: " " })).toThrow(
      ValidationError,
    );
  });

  it.each(["startDate", "endDate"] as const)(
    "requires %s, where CreateTripSchema does not",
    (field) => {
      const rest: Record<string, unknown> = { ...TRIP };
      delete rest[field];
      expect(() => parseInput(CreateDatedTripSchema, rest)).toThrow(
        ValidationError,
      );
      // The looser schema still takes it — the strictness belongs to the form.
      expect(() => parseInput(CreateTripSchema, rest)).not.toThrow();
    },
  );

  it("rejects a null date, which the looser schema reads as 'no date'", () => {
    expect(() =>
      parseInput(CreateDatedTripSchema, { ...TRIP, endDate: null }),
    ).toThrow(ValidationError);
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      parseInput(CreateDatedTripSchema, { ...TRIP, endDate: "2027-03-01" }),
    ).toThrow(ValidationError);
  });
});

describe("UpdateTripSchema", () => {
  it("omits absent keys so a patch can tell 'leave alone' from 'clear'", () => {
    const patch = parseInput(UpdateTripSchema, { name: "Japan!" });
    expect("startDate" in patch).toBe(false);
  });

  it("keeps an explicit null, which means clear the date", () => {
    const patch = parseInput(UpdateTripSchema, { startDate: null });
    expect("startDate" in patch).toBe(true);
    expect(patch.startDate).toBeNull();
  });

  it("rejects an empty patch", () => {
    expect(() => parseInput(UpdateTripSchema, {})).toThrow(ValidationError);
  });
});

describe("DayNameSchema", () => {
  it("trims the name", () => {
    expect(parseInput(DayNameSchema, "  Temple day  ")).toBe("Temple day");
  });

  it("accepts null, which means unnamed rather than blank", () => {
    expect(parseInput(DayNameSchema, null)).toBeNull();
  });

  it("rejects an empty name — clearing one is an explicit null", () => {
    expect(() => parseInput(DayNameSchema, "   ")).toThrow(ValidationError);
  });

  it("caps the length, since the column itself is unbounded text", () => {
    expect(() => parseInput(DayNameSchema, "x".repeat(201))).toThrow(
      ValidationError,
    );
  });
});

describe("ActivityDraftSchema", () => {
  it("accepts a name and summary alone", () => {
    expect(parseInput(ActivityDraftSchema, DRAFT).name).toBe("teamLab Planets");
  });

  it("requires a summary, because the column is NOT NULL", () => {
    expect(() =>
      parseInput(ActivityDraftSchema, { name: "teamLab Planets" }),
    ).toThrow(ValidationError);
  });

  it("rejects an out-of-range latitude", () => {
    expect(() =>
      parseInput(ActivityDraftSchema, { ...DRAFT, lat: 130 }),
    ).toThrow(ValidationError);
  });

  it("applies the same priority rule as PriorityScoreSchema", () => {
    expect(() =>
      parseInput(ActivityDraftSchema, { ...DRAFT, priorityScore: 6 }),
    ).toThrow(ValidationError);
  });
});

describe("parseInput", () => {
  it("reports a 400 on the thrown error", () => {
    const error = (() => {
      try {
        parseInput(CreateTripSchema, {});
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).status).toBe(400);
  });
});
