"use client";

import { useRef, useState } from "react";
import DayPlannerView from "./DayPlannerView";
import { stepDay, toggleId, type PlanDay } from "@/lib/itinerary/day-plan";

interface Props {
  /** Shaped on the server — the view never touches a `DayWithActivities`. */
  days: PlanDay[];
}

/**
 * The trip page's third container, on the same terms as `ActivityBank`:
 * which day the dialog shows, which of its stops are expanded, and refs.
 *
 * **There is no React `open` flag.** `showModal()` and Esc own the dialog's
 * openness; `index` only says which day's content it holds. The dialog's
 * `close` event is the one place every dismissal lands (Esc, ✕, backdrop), so
 * expansion resets and focus goes back to the day card there.
 *
 * Focus returns to the card of the day *currently shown*, not the one first
 * clicked: after paging with next/previous, that is the day you were reading.
 * The browser restores focus before `close` fires, so this call wins.
 */
export default function DayPlanner({ days }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function open(i: number) {
    setIndex(i);
    setExpanded(new Set());
    dialogRef.current?.showModal();
  }

  function step(delta: -1 | 1) {
    const next = stepDay(index, delta, days.length);
    if (next === null) return;
    setIndex(next);
    setExpanded(new Set());
  }

  return (
    <DayPlannerView
      days={days}
      index={index}
      expanded={expanded}
      dialogRef={dialogRef}
      cardRef={(i, el) => {
        cardRefs.current[i] = el;
      }}
      onOpen={open}
      onDismiss={() => dialogRef.current?.close()}
      onClose={() => {
        setExpanded(new Set());
        cardRefs.current[index]?.focus();
      }}
      onStep={step}
      onToggle={(id) => setExpanded((set) => toggleId(set, id))}
    />
  );
}
