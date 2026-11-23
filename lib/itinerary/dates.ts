/**
 * Calendar arithmetic on bare `YYYY-MM-DD` dates. Pure — no database import,
 * no `server-only` marker — so the create form can run it in the browser on
 * every change. Formatting stays in `format.ts`; this file only counts, steps
 * and compares.
 *
 * **Everything here steps in UTC**, for the reason `format.ts` and `eachDate`
 * in `days.ts` give: a `date` column has no zone, `new Date("2026-04-12")`
 * reads it as UTC midnight, and stepping in local time skips or repeats a day
 * across a DST boundary. The one exception is `todayIso`, which is the
 * reader's own calendar date on purpose — see there.
 *
 * ISO dates compare correctly as strings (`"2026-04-03" < "2026-04-14"`), so
 * ordering is plain `<` and nothing here parses just to compare.
 */

/**
 * Mirrors `MAX_TRIP_DAYS` in `lib/itinerary/days.ts`, **which is the
 * authority**. That file is `server-only` and does not export the constant,
 * so the form cannot import it; if the two drift, the form will let through a
 * range that `generateDays` then rejects on the trip's first view. Change both
 * together.
 */
export const MAX_TRIP_DAYS = 366;

/** Past this many days the form suggests double-checking. A hint, not a rule. */
export const LONG_TRIP_DAYS = 30;

const DAY_MS = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function at(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** A real calendar date in `YYYY-MM-DD` form — "2026-02-30" is not. */
export function isIsoDate(value: string): boolean {
  return ISO.test(value) && iso(at(value)) === value;
}

/** `date` moved by `days`, which may be negative. */
export function addDays(date: string, days: number): string {
  const d = at(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

/**
 * How many day columns the range lays out, counting both ends — the same
 * count `eachDate` produces. 3 Apr to 3 Apr is one day. `null` when either
 * end is missing or the range runs backwards.
 */
export function tripLength(start: string, end: string): number | null {
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return null;
  return Math.round((at(end).getTime() - at(start).getTime()) / DAY_MS) + 1;
}

/**
 * Today as the **reader** sees it, from their own clock and zone. This is
 * the one place local time is right: "is the departure in the past" is a
 * question about the traveller's calendar, and a UTC today would call
 * tomorrow "today" for everyone east of Greenwich in the evening.
 */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The first of the month `date` falls in. */
export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** The first of the month `months` away from the one `date` falls in. */
export function addMonths(date: string, months: number): string {
  const d = at(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + months);
  return iso(d);
}

/**
 * One month as weeks of seven, Monday first (the app formats `en-GB`).
 * Leading and trailing cells outside the month are `null`, so the caller
 * renders blanks rather than greyed-out neighbours.
 */
export function monthGrid(monthStart: string): (string | null)[][] {
  const first = at(startOfMonth(monthStart));
  // getUTCDay: Sunday 0 … Saturday 6. Shift so Monday is column 0.
  const lead = (first.getUTCDay() + 6) % 7;
  const next = new Date(first);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const days = Math.round((next.getTime() - first.getTime()) / DAY_MS);

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < days; i++) cells.push(addDays(iso(first), i));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** What the create form needs to know about a pair of dates. */
export interface TripDatesAssessment {
  /** Inclusive day count, or `null` while incomplete or backwards. */
  length: number | null;
  /** Both ends set and Return falls before Departure. */
  reversed: boolean;
  /** Departure is before the reader's today. Allowed — a hint. */
  pastDeparture: boolean;
  /** Longer than `LONG_TRIP_DAYS`. Allowed — a hint. */
  long: boolean;
  /** Longer than `MAX_TRIP_DAYS`; the server would reject the day layout. */
  tooLong: boolean;
}

export function assessTripDates(
  start: string,
  end: string,
  today: string,
): TripDatesAssessment {
  const length = tripLength(start, end);
  return {
    length,
    reversed: isIsoDate(start) && isIsoDate(end) && end < start,
    pastDeparture: isIsoDate(start) && start < today,
    long: length !== null && length > LONG_TRIP_DAYS,
    tooLong: length !== null && length > MAX_TRIP_DAYS,
  };
}
