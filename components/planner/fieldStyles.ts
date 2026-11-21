/**
 * The planner's form control styling, shared the way `buttonStyles` is: a
 * plain string both views import, rather than a wrapper component nobody
 * needs. A second copy would drift the moment one focus ring is tweaked.
 */

export const FIELD =
  "w-full rounded-xl border border-rule bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-subtle/70 focus:border-tao focus:ring-2 focus:ring-tao-wash disabled:opacity-50";

/* Native date inputs render their picker chrome from `color-scheme`, which
   would otherwise inherit the dark ground the app's `body` paints. */
export const DATE_FIELD = `${FIELD} [color-scheme:light]`;

export const LABEL =
  "mb-1.5 block text-[12px] font-medium uppercase tracking-[0.07em] text-ink-subtle";
