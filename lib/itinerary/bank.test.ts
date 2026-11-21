import { describe, expect, it } from "vitest";
import {
  bankCounts,
  filterBankEntries,
  formatBankMeta,
  toBankEntries,
  type BankEntry,
} from "./bank";
import type { Activity } from "./types";

const CREATED = new Date("2026-08-01T00:00:00Z");

function activity(
  id: string,
  name: string,
  over: Partial<Activity> = {},
): Activity {
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
  } satisfies Activity;
}

function entry(name: string, area: string | null = null): BankEntry {
  return { id: name, name, area };
}

describe("toBankEntries", () => {
  it("keeps the order it was given", () => {
    // `listActivities` sorts by priority in SQL; re-sorting here would put the
    // bank and the rest of the app in different orders.
    const entries = toBankEntries([
      activity("a", "Fushimi Inari"),
      activity("b", "Nishiki Market"),
      activity("c", "Ryōan-ji"),
    ]);

    expect(entries.map((e) => e.name)).toEqual([
      "Fushimi Inari",
      "Nishiki Market",
      "Ryōan-ji",
    ]);
  });

  it("carries the area through, and treats blank as absent", () => {
    const entries = toBankEntries([
      activity("a", "Kennin-ji", { area: "Gion" }),
      activity("b", "Ginkaku-ji", { area: null }),
      activity("c", "Kurama onsen", { area: "" }),
      activity("d", "Tea at Ippodo", { area: "   " }),
      activity("e", "Nijō Castle", { area: "  Nakagyō  " }),
    ]);

    expect(entries.map((e) => e.area)).toEqual([
      "Gion",
      null,
      null,
      null,
      "Nakagyō",
    ]);
  });

  it("projects to the three fields a row renders, and nothing else", () => {
    // What leaves here crosses into a client component, so anything extra is
    // both payload and a `Date` the RSC boundary has to serialise.
    const [only] = toBankEntries([
      activity("a", "Fushimi Inari", {
        area: "Fushimi",
        address: "68 Fukakusa Yabunouchicho",
        lat: 34.967,
        priorityScore: 5,
      }),
    ]);

    expect(only).toEqual({ id: "a", name: "Fushimi Inari", area: "Fushimi" });
  });
});

describe("bankCounts", () => {
  it("reads placed as the complement of unscheduled", () => {
    const all = [
      activity("a", "Fushimi Inari"),
      activity("b", "Nishiki Market"),
      activity("c", "Ginkaku-ji"),
    ];

    expect(bankCounts(all, [all[2]])).toEqual({ saved: 3, placed: 2 });
  });

  it("counts nothing placed when nothing is scheduled", () => {
    const all = [activity("a", "Fushimi Inari")];
    expect(bankCounts(all, all)).toEqual({ saved: 1, placed: 0 });
  });

  it("handles an empty trip", () => {
    expect(bankCounts([], [])).toEqual({ saved: 0, placed: 0 });
  });
});

describe("formatBankMeta", () => {
  it("reads as the design's meta line", () => {
    expect(formatBankMeta({ saved: 12, placed: 4 })).toBe(
      "12 saved · 4 placed on a day",
    );
    expect(formatBankMeta({ saved: 1, placed: 1 })).toBe(
      "1 saved · 1 placed on a day",
    );
  });

  it("says nothing about placement when there is nothing saved", () => {
    expect(formatBankMeta({ saved: 0, placed: 0 })).toBe("Nothing saved yet");
  });
});

describe("filterBankEntries", () => {
  const ENTRIES = [
    entry("Fushimi Inari", "Fushimi"),
    entry("Nishiki Market", "Nakagyō"),
    entry("Ryōan-ji", "North-west Kyoto"),
    entry("Kurama onsen"),
  ];

  it("returns everything for a blank or whitespace query", () => {
    expect(filterBankEntries(ENTRIES, "")).toEqual(ENTRIES);
    expect(filterBankEntries(ENTRIES, "   ")).toEqual(ENTRIES);
  });

  it("matches the name, ignoring case", () => {
    expect(filterBankEntries(ENTRIES, "MARKET").map((e) => e.name)).toEqual([
      "Nishiki Market",
    ]);
  });

  it("matches the area", () => {
    expect(filterBankEntries(ENTRIES, "kyoto").map((e) => e.name)).toEqual([
      "Ryōan-ji",
    ]);
  });

  it("folds diacritics, so a plain keyboard finds the place", () => {
    expect(filterBankEntries(ENTRIES, "ryoan").map((e) => e.name)).toEqual([
      "Ryōan-ji",
    ]);
    expect(filterBankEntries(ENTRIES, "nakagyo").map((e) => e.name)).toEqual([
      "Nishiki Market",
    ]);
  });

  it("searches an entry with no area by name alone", () => {
    expect(filterBankEntries(ENTRIES, "onsen").map((e) => e.name)).toEqual([
      "Kurama onsen",
    ]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterBankEntries(ENTRIES, "osaka")).toEqual([]);
  });
});
