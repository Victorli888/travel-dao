/**
 * Shared class strings for the landing, in the spirit of `buttonStyles`.
 *
 * `buttonStyles` carries no focus style of its own, so every landing link
 * adds this one: a visible ocean-blue ring for keyboard users only.
 */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tao";

/** The small uppercase label that sits above each section heading. */
export const eyebrow =
  "m-0 text-[12px] font-semibold uppercase tracking-[0.14em] text-tao";

/** Section headings (`h2`) share one size so the hierarchy reads at a glance. */
export const sectionHeading =
  "m-0 mt-3 font-display text-[clamp(1.75rem,3.6vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink";

/** The landing's one content width. Sections that bleed full-width wrap it. */
export const container = "mx-auto w-full max-w-[72rem] px-5 sm:px-8";
