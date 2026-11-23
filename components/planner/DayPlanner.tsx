"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import DayPlannerView from "./DayPlannerView";
import { scrollEdges, scrollToReveal, visibleRange } from "@/lib/carousel";
import { stepDay, toggleId, type PlanDay } from "@/lib/itinerary/day-plan";

interface Props {
  /** Shaped on the server — the view never touches a `DayWithActivities`. */
  days: PlanDay[];
}

/** Smooth only when the reader hasn't asked for reduced motion. */
function behavior(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/**
 * The trip page's third container, on the same terms as `ActivityBank`:
 * which day the dialog shows, which of its stops are expanded, where the
 * carousel sits, and refs.
 *
 * **There is no React `open` flag.** `showModal()` and Esc own the dialog's
 * openness; `index` only says which day's content it holds. The dialog's
 * `close` event is the one place every dismissal lands (Esc, ✕, backdrop), so
 * expansion resets and focus goes back to the day card there.
 *
 * **The carousel is native scrolling.** CSS scroll-snap does the snapping,
 * swipe and trackpad come free, and this container only *reads* the scroller
 * to drive the arrows and the "Days 1–5 of 12" indicator. The geometry lives
 * in `lib/carousel.ts`.
 *
 * Focus returns to the card of the day *currently shown*, not the one first
 * clicked: after paging with next/previous in the dialog, that is the day you
 * were reading, and the carousel has already been scrolled to it.
 */
export default function DayPlanner({ days }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollerRef = useRef<HTMLOListElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [range, setRange] = useState({ first: 0, last: 0 });
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  /** Card geometry relative to the scroller (its offset parent). */
  const items = useCallback(
    () =>
      cardRefs.current.map((card) => {
        const li = card?.parentElement;
        return { left: li?.offsetLeft ?? 0, width: li?.offsetWidth ?? 0 };
      }),
    [],
  );

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setRange(visibleRange(items(), el.scrollLeft, el.clientWidth));
    setEdges(scrollEdges(el.scrollLeft, el.clientWidth, el.scrollWidth));
  }, [items]);

  // First paint and every resize: the number of cards in view changes at
  // each breakpoint, so the indicator and arrows must be re-read.
  useEffect(() => {
    measure();
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const frame = useRef(0);
  function onScroll() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(measure);
  }

  /** One page per press: the visible width, which snap then squares up. */
  function page(delta: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    if ((delta < 0 && edges.atStart) || (delta > 0 && edges.atEnd)) return;
    el.scrollBy({ left: delta * el.clientWidth, behavior: behavior() });
  }

  /** Horizontal only, so the page behind an open dialog never moves. */
  function reveal(i: number) {
    const el = scrollerRef.current;
    const item = items()[i];
    if (!el || !item) return;
    const left = scrollToReveal(item, el.scrollLeft, el.clientWidth);
    if (left !== null) el.scrollTo({ left, behavior: behavior() });
  }

  /** ←/→ move between cards; focusing one scrolls it into view natively. */
  function onCardKey(event: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    const next = stepDay(i, delta, days.length);
    if (next === null) return;
    event.preventDefault();
    cardRefs.current[next]?.focus();
  }

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
    reveal(next);
  }

  return (
    <DayPlannerView
      days={days}
      index={index}
      expanded={expanded}
      range={range}
      atStart={edges.atStart}
      atEnd={edges.atEnd}
      dialogRef={dialogRef}
      scrollerRef={scrollerRef}
      cardRef={(i, el) => {
        cardRefs.current[i] = el;
      }}
      onScroll={onScroll}
      onPage={page}
      onCardKey={onCardKey}
      onOpen={open}
      onDismiss={() => dialogRef.current?.close()}
      onClose={() => {
        setExpanded(new Set());
        // Already revealed by `step`, so focusing need not scroll again.
        cardRefs.current[index]?.focus({ preventScroll: true });
      }}
      onStep={step}
      onToggle={(id) => setExpanded((set) => toggleId(set, id))}
    />
  );
}
