/**
 * The trip page's read model: each day, and each activity on it, projected
 * down to the strings the overview and the day dialog render.
 *
 * Pure — no database import, no `server-only` — so the page can shape on the
 * server and the client container can import the types and helpers. Imported
 * by path, never through `./index`, for the same reason as `bank.ts`.
 *
 * **There are no times.** The schema has no start or end time on a placement;
 * order is `position` (already sorted by `groupDays`). What a stop can carry is
 * a duration and the place's opening hours, and both are shown when recorded.
 */
import {
  formatDayLabel,
  formatDayMonth,
  formatSpokenDate,
  formatWeekday,
} from "./format";
import type { DayWithActivities, PlacedActivity } from "./types";

/** One labelled line in an expanded activity. Only recorded fields appear. */
export type StopDetail = { label: string; value: string };

export type PlanStop = {
  id: string;
  name: string;
  /** The neighbourhood. NULL means not recorded — the line is omitted. */
  area: string | null;
  /** "1 h 30 min", or NULL when unknown. Shown collapsed as well. */
  duration: string | null;
  summary: string | null;
  /** 1–5, NULL = not yet prioritised. 5 earns the ember highlight. */
  priority: number | null;
  /** "Must-do", "Maybe", "Priority 3 of 5"; NULL when not prioritised. */
  priorityLabel: string | null;
  details: StopDetail[];
  /** A maps search for the recorded coordinates, when both are present. */
  mapHref: string | null;
};

export type PlanDay = {
  id: string;
  /** 1-based, in trip order. */
  number: number;
  /** The user's name for the day, or the short date when it has none. */
  title: string;
  /** The short date under a named day; NULL when the title already is it. */
  dateLabel: string | null;
  /** "Tue 14 Apr" — always the short date. */
  shortDate: string;
  /**
   * The card's two lines, chosen so the date is never said twice: a named day
   * reads "Tuesday · 14 April" over its name, an unnamed one "Tuesday" over
   * "14 April".
   */
  kicker: string;
  heading: string;
  /** "Tuesday 14 April 2026" — always the full date, for the dialog. */
  spokenDate: string;
  stops: PlanStop[];
  /** Distinct recorded areas of the day's stops, first-seen order. */
  areas: string[];
};

/** Trip-level totals for the summary strip. Counts only what is recorded. */
export type PlanSummary = {
  days: number;
  /** Placements — an activity on two days is two stops. */
  stops: number;
  /** Distinct recorded areas across every placed stop. */
  areas: number;
};

function orNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** "45 min", "2 h", "1 h 30 min". NULL, zero and negatives are unknown. */
export function formatDuration(minutes: number | null): string | null {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** 1 = maybe, 5 = must-do (schema). NULL means not yet prioritised. */
export function formatPriority(score: number | null): string | null {
  if (score === null) return null;
  if (score === 5) return "Must-do";
  if (score === 1) return "Maybe";
  return `Priority ${score} of 5`;
}

export function toPlanStop(activity: PlacedActivity): PlanStop {
  const duration = formatDuration(activity.durationMinutes);
  const details: StopDetail[] = [];
  const push = (label: string, value: string | null) => {
    if (value) details.push({ label, value });
  };

  push("Address", orNull(activity.address));
  push("Hours", orNull(activity.hoursOperation));
  push("Time needed", duration);
  push("Type", orNull(activity.activityType));
  push("Country", orNull(activity.country));

  const mapHref =
    activity.lat !== null && activity.lng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${activity.lat},${activity.lng}`
      : null;

  return {
    id: activity.id,
    name: activity.name,
    area: orNull(activity.area),
    duration,
    summary: orNull(activity.summary),
    priority: activity.priorityScore,
    priorityLabel: formatPriority(activity.priorityScore),
    details,
    mapHref,
  };
}

/** Days arrive in date order with activities already sorted by position. */
export function toPlanDays(days: DayWithActivities[]): PlanDay[] {
  return days.map((day, i) => {
    const short = formatDayLabel(day.date);
    const stops = day.activities.map(toPlanStop);
    const weekday = formatWeekday(day.date);
    const dayMonth = formatDayMonth(day.date);
    return {
      id: day.id,
      number: i + 1,
      // NULL means unnamed, so the date is the fallback identity.
      title: day.name ?? short,
      dateLabel: day.name ? short : null,
      shortDate: short,
      kicker: day.name ? `${weekday} · ${dayMonth}` : weekday,
      heading: day.name ?? dayMonth,
      spokenDate: formatSpokenDate(day.date),
      stops,
      areas: distinctAreas(stops),
    };
  });
}

/** Areas are never derived from addresses — NULL areas are simply skipped. */
function distinctAreas(stops: PlanStop[]): string[] {
  return [...new Set(stops.flatMap((stop) => (stop.area ? [stop.area] : [])))];
}

export function summarizePlan(days: PlanDay[]): PlanSummary {
  return {
    days: days.length,
    stops: days.reduce((n, day) => n + day.stops.length, 0),
    areas: distinctAreas(days.flatMap((day) => day.stops)).length,
  };
}

/** The neighbouring day's index, or NULL past either end. */
export function stepDay(
  index: number,
  delta: -1 | 1,
  length: number,
): number | null {
  const next = index + delta;
  return next >= 0 && next < length ? next : null;
}

/** Toggles one id in an expansion set without mutating it. */
export function toggleId(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
