/**
 * The planner's form control styling, shared the way `buttonStyles` is: a
 * plain string the views import, rather than a wrapper component nobody
 * needs. A second copy would drift the moment one focus ring is tweaked.
 *
 * The vocabulary is the landing's (`components/landing/`): rounded-xl
 * controls on paper, a soft sky halo on focus, and the navy `tao` border as
 * the focused edge. Sky is only ever a halo or wash here — never text.
 */

export const FIELD =
  "w-full rounded-xl border border-rule bg-paper px-4 py-3 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-subtle hover:border-rule-strong focus:border-tao focus:ring-4 focus:ring-sky/30 aria-[invalid=true]:border-ink disabled:opacity-50";

/* Native date inputs render their picker chrome from `color-scheme`, which
   would otherwise inherit the dark ground the app's `body` paints. */
export const DATE_FIELD = `${FIELD} [color-scheme:light]`;

export const LABEL = "mb-2 block text-[13px] font-semibold text-ink";

/**
 * A field's message line. Hints are quiet; errors are ink and semibold with a
 * glyph, because the palette has no error colour and `ember` is a fill, never
 * text (it fails contrast on white).
 */
export const HINT_TEXT =
  "m-0 mt-2 flex items-start gap-1.5 text-[13px] leading-snug text-ink-muted";
export const ERROR_TEXT =
  "m-0 mt-2 flex items-start gap-1.5 text-[13px] font-semibold leading-snug text-ink";
