import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
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
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-tao-wash hover:text-tao"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <p className="m-0 text-[13px] text-ink-muted" aria-live="polite">
          {phase === "start" ? "Pick the departure date" : "Now pick the return date"}
        </p>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-tao-wash hover:text-tao"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div
        className="mt-3 flex gap-6"
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
            <caption className="pb-2 text-[14px] font-medium tracking-tight text-ink">
              {formatMonthYear(month)}
            </caption>
            <thead>
              <tr>
                {WEEKDAYS.map((d) => (
                  <th
                    key={d}
                    scope="col"
                    className="h-8 w-10 text-[11px] font-medium uppercase tracking-[0.07em] text-ink-subtle"
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
                          inRange && "bg-tao-wash",
                          // Half a wash behind each end, so the band runs into
                          // the endpoints instead of stopping a gap short.
                          spans && isStart && "bg-[linear-gradient(to_right,transparent_50%,var(--color-tao-wash)_50%)]",
                          spans && isEnd && "bg-[linear-gradient(to_left,transparent_50%,var(--color-tao-wash)_50%)]",
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
                            "flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-[14px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-tao",
                            endpoint
                              ? "bg-tao font-medium text-paper"
                              : "text-ink hover:bg-tao-wash hover:text-tao",
                            date === today && !endpoint && "font-semibold text-tao underline underline-offset-4",
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

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-subtle transition-colors hover:text-tao"
        >
          Done
        </button>
      </div>
    </div>
  );
}
