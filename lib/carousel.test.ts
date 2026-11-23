import { describe, expect, it } from "vitest";
import { formatRange, scrollEdges, scrollToReveal, visibleRange } from "./carousel";

/** Five 200px cards with 16px gaps: lefts 0, 216, 432, 648, 864. */
const cards = Array.from({ length: 5 }, (_, i) => ({ left: i * 216, width: 200 }));

describe("visibleRange", () => {
  it("reports every card that fits whole", () => {
    expect(visibleRange(cards, 0, 632)).toEqual({ first: 0, last: 2 });
    expect(visibleRange(cards, 216, 632)).toEqual({ first: 1, last: 3 });
  });

  it("falls back to the most-visible card when none fits whole", () => {
    // A phone: 180px viewport, narrower than one card.
    expect(visibleRange(cards, 0, 180)).toEqual({ first: 0, last: 0 });
    expect(visibleRange(cards, 150, 180)).toEqual({ first: 1, last: 1 });
  });

  it("tolerates sub-pixel snap positions", () => {
    expect(visibleRange(cards, 215.4, 633)).toEqual({ first: 1, last: 3 });
  });

  it("handles an empty track", () => {
    expect(visibleRange([], 0, 500)).toEqual({ first: 0, last: 0 });
  });
});

describe("scrollEdges", () => {
  it("knows both ends, with tolerance", () => {
    expect(scrollEdges(0, 632, 1064)).toEqual({ atStart: true, atEnd: false });
    expect(scrollEdges(431.5, 632, 1064)).toEqual({ atStart: false, atEnd: true });
    expect(scrollEdges(0, 1100, 1064)).toEqual({ atStart: true, atEnd: true });
  });
});

describe("scrollToReveal", () => {
  it("leaves a visible card alone", () => {
    expect(scrollToReveal(cards[1], 0, 632)).toBeNull();
  });

  it("moves the shortest distance either way", () => {
    expect(scrollToReveal(cards[4], 0, 632)).toBe(864 + 200 - 632);
    expect(scrollToReveal(cards[0], 432, 632)).toBe(0);
  });
});

describe("formatRange", () => {
  it("reads naturally for one, several and none", () => {
    expect(formatRange(2, 2, 12)).toBe("Day 3 of 12");
    expect(formatRange(0, 4, 12)).toBe("Days 1–5 of 12");
    expect(formatRange(0, 0, 0)).toBe("No days");
  });
});
