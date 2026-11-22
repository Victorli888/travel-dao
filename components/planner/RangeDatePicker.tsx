"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ToggleEvent,
} from "react";
import RangeCalendarView from "./RangeCalendarView";
import RangeDatePickerView from "./RangeDatePickerView";
import {
  addDays,
  addMonths,
  monthGrid,
  startOfMonth,
  todayIso,
} from "@/lib/itinerary/dates";

interface Props {
  start: string;
  end: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  startDescribedBy: string | undefined;
  endDescribedBy: string | undefined;
  disabled: boolean;
}

/** Gap between the fields and the calendar, and from the viewport edge. */
const GAP = 8;
const EDGE = 16;

const KEY_STEP: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/**
 * Container for the desktop range picker: one calendar, two clicks. The
 * values themselves belong to `NewTripForm`; this holds only what the open
 * calendar needs — which end the next click sets, the month in view, the
 * hovered date, the focused cell — and the two refs.
 *
 * Openness is not here. The native popover owns it (see the view), so the
 * calendar renders only once `viewMonth` is set on first open. That also
 * keeps "today" out of the server render, where the server's clock and zone
 * would disagree with the reader's.
 */
export default function RangeDatePicker({
  start,
  end,
  onStartChange,
  onEndChange,
  startDescribedBy,
  endDescribedBy,
  disabled,
}: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  /** Set by arrow keys, so the effect below moves DOM focus only for them. */
  const keyboardMoved = useRef(false);

  const [phase, setPhase] = useState<"start" | "end">("start");
  const [viewMonth, setViewMonth] = useState("");
  const [focusDate, setFocusDate] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [today, setToday] = useState("");

  function open(nextPhase: "start" | "end") {
    const now = todayIso();
    const focus = (nextPhase === "end" ? end || start : start) || now;
    setToday(now);
    setPhase(nextPhase);
    setFocusDate(focus);
    setViewMonth(startOfMonth(focus));
    setPreview(null);
  }

  function close() {
    popoverRef.current?.hidePopover();
  }

  function pick(date: string) {
    setFocusDate(date);
    if (phase === "start" || !start || date < start) {
      // A Return click before Departure starts the range again from there —
      // the usual range-picker convention, and it can never leave the pair
      // reversed.
      onStartChange(date);
      setPhase("end");
      return;
    }
    onEndChange(date);
    close();
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLElement>) {
    const step = KEY_STEP[event.key];
    const months =
      event.key === "PageUp" ? -1 : event.key === "PageDown" ? 1 : 0;
    if (!step && !months) return;
    event.preventDefault();

    const from = focusDate || today;
    const next = step
      ? addDays(from, step)
      : // Same day-of-month a month away, clamped by `addDays` overflow.
        addDays(addMonths(from, months), Number(from.slice(8)) - 1);

    keyboardMoved.current = true;
    setFocusDate(next);
    // Keep the focused day on screen: page one month at a time.
    const lastShown = addMonths(viewMonth, 1);
    if (next < viewMonth) setViewMonth(startOfMonth(next));
    else if (startOfMonth(next) > lastShown)
      setViewMonth(addMonths(startOfMonth(next), -1));
  }

  useEffect(() => {
    if (!keyboardMoved.current) return;
    keyboardMoved.current = false;
    popoverRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)
      ?.focus();
  }, [focusDate, viewMonth]);

  function onToggle(event: ToggleEvent<HTMLDivElement>) {
    const popover = popoverRef.current;
    const anchor = anchorRef.current;
    if (event.newState !== "open" || !popover || !anchor) return;

    // `absolute` in the top layer is placed against the document, so add the
    // scroll offset; clamp so a two-month calendar never leaves the viewport.
    const rect = anchor.getBoundingClientRect();
    const width = popover.offsetWidth;
    const maxLeft = window.innerWidth - width - EDGE;
    popover.style.top = `${rect.bottom + window.scrollY + GAP}px`;
    popover.style.left = `${Math.max(EDGE, Math.min(rect.left, maxLeft)) + window.scrollX}px`;

    popover
      .querySelector<HTMLButtonElement>('[tabindex="0"][data-date]')
      ?.focus();
  }

  const shown = viewMonth ? [viewMonth, addMonths(viewMonth, 1)] : [];
  // Month arrows can page the focused day out of view; the grid must still
  // have one tab stop, so fall back to the first day shown.
  const lastShownDay = viewMonth ? addDays(addMonths(viewMonth, 2), -1) : "";
  const tabDate =
    focusDate >= viewMonth && focusDate <= lastShownDay ? focusDate : viewMonth;

  return (
    <RangeDatePickerView
      anchorRef={anchorRef}
      popoverRef={popoverRef}
      start={start}
      end={end}
      startDescribedBy={startDescribedBy}
      endDescribedBy={endDescribedBy}
      disabled={disabled}
      onOpenStart={() => open("start")}
      onOpenEnd={() => open("end")}
      onToggle={onToggle}
    >
      {viewMonth && (
        <RangeCalendarView
          months={shown.map((month) => ({ month, weeks: monthGrid(month) }))}
          start={start}
          end={end}
          preview={preview}
          focusDate={tabDate}
          today={today}
          phase={phase}
          onPick={pick}
          onPreview={setPreview}
          onGridKeyDown={onGridKeyDown}
          onPrevMonth={() => setViewMonth(addMonths(viewMonth, -1))}
          onNextMonth={() => setViewMonth(addMonths(viewMonth, 1))}
          onDone={close}
        />
      )}
    </RangeDatePickerView>
  );
}
