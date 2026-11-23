/**
 * Geometry for a native scroll-snap carousel. Pure numbers in, numbers out,
 * so the container can read `offsetLeft`/`clientWidth` from the DOM and the
 * decisions stay unit-testable. No library: CSS `scroll-snap` does the
 * snapping, and these helpers do the counting.
 *
 * Every `left` is relative to the scroller's content box, i.e. the item's
 * `offsetLeft` when the scroller is its offset parent.
 */

export type Item = { left: number; width: number };

/** Sub-pixel tolerance: snapped positions are rarely exact integers. */
const EPS = 2;

/**
 * Indices of the first and last items fully in view. When none fits whole —
 * a phone showing one card and a peek, mid-swipe — the item covering the most
 * of the viewport stands in for both, so the indicator never reads "0".
 */
export function visibleRange(
  items: Item[],
  scrollLeft: number,
  viewport: number,
): { first: number; last: number } {
  if (items.length === 0) return { first: 0, last: 0 };
  const right = scrollLeft + viewport;
  let first = -1;
  let last = -1;
  items.forEach((item, i) => {
    if (item.left >= scrollLeft - EPS && item.left + item.width <= right + EPS) {
      if (first === -1) first = i;
      last = i;
    }
  });
  if (first !== -1) return { first, last };

  let best = 0;
  let bestOverlap = -Infinity;
  items.forEach((item, i) => {
    const overlap =
      Math.min(item.left + item.width, right) - Math.max(item.left, scrollLeft);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = i;
    }
  });
  return { first: best, last: best };
}

/** At either end of the track, for disabling the arrow buttons. */
export function scrollEdges(
  scrollLeft: number,
  viewport: number,
  scrollWidth: number,
): { atStart: boolean; atEnd: boolean } {
  return {
    atStart: scrollLeft <= EPS,
    atEnd: scrollLeft + viewport >= scrollWidth - EPS,
  };
}

/**
 * The scrollLeft that brings an item fully into view by the shortest move,
 * or NULL when it already is. Horizontal only — unlike `scrollIntoView`, it
 * never scrolls the page behind an open dialog.
 */
export function scrollToReveal(
  item: Item,
  scrollLeft: number,
  viewport: number,
): number | null {
  if (item.left < scrollLeft - EPS) return item.left;
  if (item.left + item.width > scrollLeft + viewport + EPS) {
    return item.left + item.width - viewport;
  }
  return null;
}

/** "Day 3 of 12" or "Days 1–5 of 12" — the position indicator's text. */
export function formatRange(first: number, last: number, total: number): string {
  if (total === 0) return "No days";
  if (first === last) return `Day ${first + 1} of ${total}`;
  return `Days ${first + 1}–${last + 1} of ${total}`;
}
