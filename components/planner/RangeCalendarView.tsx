import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/landing/styles";

const MONTH_NAV =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-rule/70 text-[18px] leading-none text-tao transition-colors hover:border-sky hover:bg-sky/15";

import {
  formatMonthYear,
  formatSpokenDate,
} from "@/lib/itinerary/format";

/** Monday first, matching `monthGrid` and the app's `en-GB` formatting. */
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

interface Props {
  /**
   * Months to draw, left to right, each as weeks of seven (`null` = blank
   * cell). Built by the container; the second hides below `sm`.
   */
  months: { month: string; weeks: (string | null)[][] }[];
  start: string;
  end: string;
  /** Hovered or focused date while choosing Return — previews the range. */
  preview: string | null;
  /** The one cell in the tab order (roving tabindex). */
  focusDate: string;
  today: string;
  /** Which end the next click sets. Drives the instruction line. */
  phase: "start" | "end";
  onPick: (date: string) => void;
  onPreview: (date: string | null) => void;
  onGridKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDone: () => void;
}

/**
 * Pure. One or two month grids with a range painted across them.
 *
 * Each day is a real `<button>` named in full ("Saturday 3 April 2027"), so a
 * screen reader hears a date rather than a bare number, and the grid is a
 * single tab stop: arrows move inside it, Tab leaves it.
 */
export default function RangeCalendarView({
  months,
  start,
  end,
  preview,
  focusDate,
  today,
  phase,
  onPick,
  onPreview,
  onGridKeyDown,
  onPrevMonth,
  onNextMonth,
  onDone,
}: Props) {
  // While choosing Return, the hovered date stands in for the end.
  const rangeEnd =
    phase === "end" && start && preview && preview >= start ? preview : end;
  const spans = Boolean(start && rangeEnd && rangeEnd > start);

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className={cn(MONTH_NAV, focusRing)}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.14em] text-tao" aria-live="polite">
          {phase === "start" ? "Pick the departure date" : "Now pick the return date"}
        </p>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className={cn(MONTH_NAV, focusRing)}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div
        className="mt-4 flex items-start gap-8"
        onKeyDown={onGridKeyDown}
        onMouseLeave={() => onPreview(null)}
      >
        {months.map(({ month, weeks }, i) => (
          <table
            key={month}
            role="grid"
            aria-label={formatMonthYear(month)}
            className={cn("border-collapse", i > 0 && "hidden sm:table")}
          >
            <caption className="pb-3 text-[15px] font-semibold tracking-tight text-ink">
              {formatMonthYear(month)}
            </caption>
            <thead>
              <tr>
                {WEEKDAYS.map((d) => (
                  <th
                    key={d}
                    scope="col"
                    className="h-8 w-10 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-subtle"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, w) => (
                <tr key={w}>
                  {week.map((date, d) => {
                    if (!date) return <td key={d} className="h-10 w-10" />;

                    const isStart = date === start;
                    const isEnd = date === rangeEnd;
                    const inRange =
                      Boolean(start && rangeEnd) && date > start && date < rangeEnd;
                    const endpoint = isStart || isEnd;

                    return (
                      <td
                        key={d}
                        className={cn(
                          "h-10 w-10 p-0",
                          inRange && "bg-sky/[0.22]",
                          // Half a wash behind each end, so the band runs into
                          // the endpoints instead of stopping a gap short.
                          spans && isStart && "bg-[linear-gradient(to_right,transparent_50%,color-mix(in_srgb,var(--color-sky)_22%,transparent)_50%)]",
                          spans && isEnd && "bg-[linear-gradient(to_left,transparent_50%,color-mix(in_srgb,var(--color-sky)_22%,transparent)_50%)]",
                        )}
                      >
                        <button
                          type="button"
                          data-date={date}
                          tabIndex={date === focusDate ? 0 : -1}
                          aria-label={formatSpokenDate(date)}
                          aria-pressed={endpoint}
                          aria-current={date === today ? "date" : undefined}
                          onClick={() => onPick(date)}
                          onMouseEnter={() => onPreview(date)}
                          onFocus={() => onPreview(date)}
                          className={cn(
                            "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[14px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-tao focus-visible:ring-offset-2",
                            endpoint
                              ? "bg-tao font-semibold text-paper shadow-sm shadow-tao/30"
                              : "text-ink hover:bg-sky/30 hover:text-tao",
                            date === today && !endpoint && "font-semibold text-tao ring-1 ring-inset ring-sky",
                          )}
                        >
                          {Number(date.slice(8))}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      <div className="mt-4 flex justify-end border-t border-rule/70 pt-4">
        <button
          type="button"
          onClick={onDone}
          className={cn(
            "cursor-pointer rounded-md text-[14px] font-semibold text-tao transition-colors hover:text-tao-bright",
            focusRing,
          )}
        >
          Done
        </button>
      </div>
    </div>
  );
}
