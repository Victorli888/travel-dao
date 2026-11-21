/**
 * The Activity Bank: projecting a trip's activities down to what its rows
 * actually render, counting them, and searching them.
 *
 * Pure — no database import, no `server-only`. `filterBankEntries` runs in the
 * browser on every keystroke, so this file must stay importable from a client
 * component, which is also why it is **not** re-exported from `./index`:
 * that barrel carries `server-only` and a barrel import would fail at runtime.
 *
 * Separate from `shape.ts` on purpose. That file is about turning join rows
 * into a document; this one is about one screen's read model.
 */
import type { Activity } from "./types";

/** One row of the bank: a name, and an area when we have one. */
export type BankEntry = {
  id: string;
  name: string;
  /** NULL means *not recorded* — the row omits the line rather than filling it. */
  area: string | null;
};

export type BankCounts = {
  saved: number;
  /** Activities on at least one day. An activity on two days counts once. */
  placed: number;
};

/** Blank and whitespace are the same state as absent. One spelling, like `name`. */
function orNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Projects to the three fields a row renders and nothing else, so the RSC
 * payload carries no `Date` and the view has no domain data to transform.
 *
 * Order is the caller's — `listActivities` already sorts by priority — and is
 * deliberately not re-derived here.
 */
export function toBankEntries(activities: Activity[]): BankEntry[] {
  return activities.map((activity) => ({
    id: activity.id,
    name: activity.name,
    area: orNull(activity.area),
  }));
}

/**
 * `unscheduled` is the complement of `activities` over the same snapshot, so
 * the placed count is the remainder — no second query, and an activity on two
 * days is still one activity.
 */
export function bankCounts(
  activities: Activity[],
  unscheduled: Activity[],
): BankCounts {
  return {
    saved: activities.length,
    placed: activities.length - unscheduled.length,
  };
}

/** "12 saved · 4 placed on a day". */
export function formatBankMeta(counts: BankCounts): string {
  if (counts.saved === 0) return "Nothing saved yet";
  const saved = `${counts.saved} saved`;
  return `${saved} · ${counts.placed} placed on a day`;
}

/**
 * Case- and diacritic-insensitive, so "ryoanji" finds "Ryōan-ji".
 *
 * It searches **only what the row shows** — the name and the area. Matching
 * `summary` would return rows whose reason for matching is invisible, which
 * reads as a bug rather than a feature.
 */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function filterBankEntries(
  entries: BankEntry[],
  query: string,
): BankEntry[] {
  const needle = fold(query.trim());
  if (!needle) return entries;

  return entries.filter((entry) => {
    if (fold(entry.name).includes(needle)) return true;
    return entry.area !== null && fold(entry.area).includes(needle);
  });
}
