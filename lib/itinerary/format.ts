/**
 * Turning `date` columns into English. Pure — no database import, no
 * `server-only` marker, so both server pages and client components may use it.
 *
 * **Everything here formats in UTC, and that is load-bearing.** A Postgres
 * `date` is a bare `YYYY-MM-DD` with no zone; `new Date("2026-04-12")` parses
 * it as UTC midnight, so formatting in local time renders the *previous* day
 * for every reader west of Greenwich. Same reason `eachDate` in `days.ts`
 * steps in UTC.
 */

const UTC = "UTC";
const LOCALE = "en-GB";

function at(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function part(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: UTC }).format(
    at(date),
  );
}

/** "Sun 12 Apr" — a column heading, so the weekday leads. */
export function formatDayLabel(date: string): string {
  return part(date, { weekday: "short", day: "numeric", month: "short" });
}

/** "12 April 2026". */
export function formatFullDate(date: string): string {
  return part(date, { day: "numeric", month: "long", year: "numeric" });
}

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = {
  ...DAY_MONTH,
  year: "numeric",
};

/**
 * A range with nothing repeated: "12–19 Apr 2026", "29 Mar – 4 Apr 2026",
 * "29 Dec 2026 – 3 Jan 2027". One day is just that day.
 *
 * Either end may be missing — the data layer allows a dateless trip even
 * though the create form does not.
 */
export function formatDateRange(
  start: string | null,
  end: string | null,
): string {
  if (!start && !end) return "No dates yet";
  if (!start) return `Until ${part(end!, DAY_MONTH_YEAR)}`;
  if (!end) return `From ${part(start, DAY_MONTH_YEAR)}`;
  if (start === end) return part(start, DAY_MONTH_YEAR);

  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);

  if (sameMonth) return `${part(start, { day: "numeric" })}–${part(end, DAY_MONTH_YEAR)}`;
  if (sameYear) return `${part(start, DAY_MONTH)} – ${part(end, DAY_MONTH_YEAR)}`;
  return `${part(start, DAY_MONTH_YEAR)} – ${part(end, DAY_MONTH_YEAR)}`;
}

/** "April 2027" — a calendar's month heading. */
export function formatMonthYear(date: string): string {
  return part(date, { month: "long", year: "numeric" });
}

/** "Saturday 3 April 2027" — a calendar cell's accessible name. */
export function formatSpokenDate(date: string): string {
  return part(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "1 day", "12 days". */
export function formatDayCount(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** "Tuesday" — a day card's kicker. */
export function formatWeekday(date: string): string {
  return part(date, { weekday: "long" });
}

/** "14 April" — an unnamed day card's heading; the year is the trip's. */
export function formatDayMonth(date: string): string {
  return part(date, { day: "numeric", month: "long" });
}
