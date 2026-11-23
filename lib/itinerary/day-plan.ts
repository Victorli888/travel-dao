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
import { formatDayLabel, formatSpokenDate } from "./format";
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
  /** "Tuesday 14 April 2026" — always the full date, for the dialog. */
  spokenDate: string;
  stops: PlanStop[];
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
  if (score === 5) return "Must-do (5 of 5)";
  if (score === 1) return "Maybe (1 of 5)";
  return `${score} of 5`;
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
  push("Priority", formatPriority(activity.priorityScore));
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
    details,
    mapHref,
  };
}

/** Days arrive in date order with activities already sorted by position. */
export function toPlanDays(days: DayWithActivities[]): PlanDay[] {
  return days.map((day, i) => {
    const short = formatDayLabel(day.date);
    return {
      id: day.id,
      number: i + 1,
      // NULL means unnamed, so the date is the fallback identity.
      title: day.name ?? short,
      dateLabel: day.name ? short : null,
      spokenDate: formatSpokenDate(day.date),
      stops: day.activities.map(toPlanStop),
    };
  });
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
