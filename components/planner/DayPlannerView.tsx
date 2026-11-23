import type { KeyboardEvent, RefObject } from "react";
import RouteMotif from "./RouteMotif";
import { buttonStyles } from "@/components/ui/Button";
import { ChevronIcon, PinIcon, XIcon } from "@/components/ui/icons";
import { formatRange } from "@/lib/carousel";
import { cn } from "@/lib/cn";
import type { PlanDay, PlanStop } from "@/lib/itinerary/day-plan";

interface Props {
  days: PlanDay[];
  /** The day the dialog holds. Meaningless while it is closed. */
  index: number;
  /** Stop ids expanded in the dialog. */
  expanded: ReadonlySet<string>;
  /** Cards fully in view, for the indicator. */
  range: { first: number; last: number };
  atStart: boolean;
  atEnd: boolean;
  dialogRef: RefObject<HTMLDialogElement | null>;
  scrollerRef: RefObject<HTMLOListElement | null>;
  cardRef: (index: number, el: HTMLButtonElement | null) => void;
  onScroll: () => void;
  /** One carousel page back or forward. */
  onPage: (delta: -1 | 1) => void;
  onCardKey: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onOpen: (index: number) => void;
  /** Closes the dialog. Shared by ✕ and a backdrop click. */
  onDismiss: () => void;
  /** The dialog's own `close` event — Esc arrives here and nowhere else. */
  onClose: () => void;
  onStep: (delta: -1 | 1) => void;
  onToggle: (stopId: string) => void;
}

const PREVIEW = 3;
const AREA_CHIPS = 2;

/**
 * Card widths per breakpoint: about 1.2 cards below `md` (one and a peek of
 * the next, so a phone stays readable), then 3, 4 and 5 across. Each is
 * `(track − gaps) / n` with the track's 1rem gap, so n cards fit exactly and
 * snap lands on a card edge. At every breakpoint that is ~225px or more,
 * which fits the three-stop preview.
 */
const SLIDE =
  "w-[calc((100%-1rem)/1.2)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)] xl:w-[calc((100%-4rem)/5)]";

/** Round arrow buttons for the carousel. */
const ARROW = cn(
  "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-tao bg-paper text-tao transition-colors hover:bg-tao-wash",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tao",
);

/**
 * `aria-disabled`, not `disabled`, on next/previous: stepping onto the last
 * day would otherwise disable the very button holding focus and drop focus to
 * the dialog body. The container already ignores a step past either end.
 */
const EDGE = "aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:bg-transparent";

/**
 * Chip colours, each checked for AA on white: ocean on a sky tint (~9:1),
 * ocean on `tao-wash` (~9:1), ink on an ember tint (~15:1). Ember is a fill
 * here, never text, as everywhere else.
 */
const CHIP = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium";
const AREA_CHIP = cn(CHIP, "bg-sky/20 text-tao");
const SOFT_CHIP = cn(CHIP, "bg-tao-wash text-tao");
const MUST_CHIP = cn(CHIP, "bg-ember/15 text-ink");

function stopCount(n: number): string {
  return `${n} ${n === 1 ? "stop" : "stops"}`;
}

function AreaChip({ area }: { area: string }) {
  return (
    <span className={AREA_CHIP}>
      <PinIcon size={11} />
      {area}
    </span>
  );
}

/** 5 is must-do (schema), the one priority worth an ember highlight. */
function PriorityChip({ stop }: { stop: PlanStop }) {
  if (!stop.priorityLabel) return null;
  if (stop.priority === 5) {
    return (
      <span className={MUST_CHIP}>
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ember" />
        {stop.priorityLabel}
      </span>
    );
  }
  return <span className={SOFT_CHIP}>{stop.priorityLabel}</span>;
}

/** One carousel slide: a button that opens the day in the dialog. */
function DayCard({
  day,
  index,
  total,
  cardRef,
  onKey,
  onOpen,
}: {
  day: PlanDay;
  index: number;
  total: number;
  cardRef: Props["cardRef"];
  onKey: Props["onCardKey"];
  onOpen: Props["onOpen"];
}) {
  const extra = day.stops.length - PREVIEW;
  const empty = day.stops.length === 0;
  const extraAreas = day.areas.length - AREA_CHIPS;

  return (
    <li
      className={cn("flex shrink-0 snap-start", SLIDE)}
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}`}
    >
      <button
        type="button"
        ref={(el) => cardRef(index, el)}
        onClick={() => onOpen(index)}
        onKeyDown={(event) => onKey(event, index)}
        aria-haspopup="dialog"
        className={cn(
          "group relative flex min-h-[19rem] w-full cursor-pointer flex-col overflow-hidden rounded-3xl bg-paper text-left",
          "ring-1 ring-rule/70 shadow-[0_16px_32px_-24px] shadow-tao/40",
          "transition-shadow hover:ring-tao/50 hover:shadow-[0_20px_40px_-20px]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tao",
        )}
      >
        {/* The accent stripe: sky for a planned day, a quiet rule for an empty one. */}
        <span
          aria-hidden="true"
          className={cn("absolute inset-y-0 left-0 w-1.5", empty ? "bg-rule" : "bg-sky")}
        />

        <span className="flex items-start justify-between gap-3 pl-6 pr-5 pt-5">
          <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-tao text-paper">
            <span className="text-[9px] font-semibold uppercase leading-none tracking-[0.16em] text-sky">
              Day
            </span>
            <span className="mt-0.5 font-display text-[22px] font-semibold leading-none">
              {day.number}
            </span>
          </span>
          <span className={cn(empty ? cn(CHIP, "bg-paper-raised text-ink-subtle") : SOFT_CHIP, "mt-0.5")}>
            {stopCount(day.stops.length)}
          </span>
        </span>

        <span className="block pl-6 pr-5 pt-4">
          <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-tao">
            {day.kicker}
          </span>
          <span className="mt-1 line-clamp-2 font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            {day.heading}
          </span>
        </span>

        {empty ? (
          <span className="relative mb-5 flex flex-1 flex-col justify-end pl-6 pr-5 pt-3">
            <RouteMotif className="absolute right-2 top-0 w-36 opacity-60" />
            <span className="relative text-[14px] leading-relaxed text-ink-subtle">
              Nothing planned yet.
            </span>
          </span>
        ) : (
          <ol className="m-0 mb-5 mt-4 list-none space-y-2.5 pl-6 pr-5">
            {day.stops.slice(0, PREVIEW).map((stop, i) => (
              <li key={stop.id} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky/25 text-[11px] font-semibold text-tao"
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-medium text-ink">{stop.name}</span>
                    {stop.priority === 5 && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember">
                        <span className="sr-only">, must-do</span>
                      </span>
                    )}
                  </span>
                  {stop.area && (
                    <span className="block truncate text-[12px] text-ink-subtle">{stop.area}</span>
                  )}
                </span>
              </li>
            ))}
            {extra > 0 && (
              <li className="pl-7 text-[12px] font-medium text-tao">+{extra} more</li>
            )}
          </ol>
        )}

        <span className="mx-5 ml-6 mt-auto flex flex-col gap-2.5 border-t border-rule/60 py-4">
          <span className="flex min-w-0 flex-wrap gap-1.5">
            {day.areas.length === 0 ? (
              <span className="text-[12px] text-ink-subtle">No areas yet</span>
            ) : (
              <>
                <span className="sr-only">Areas: </span>
                {day.areas.slice(0, AREA_CHIPS).map((area) => (
                  <AreaChip key={area} area={area} />
                ))}
                {extraAreas > 0 && <span className={SOFT_CHIP}>+{extraAreas}</span>}
              </>
            )}
          </span>
          <span className="text-[13px] font-semibold text-tao group-hover:text-tao-bright">
            View day <span aria-hidden="true">→</span>
          </span>
        </span>
      </button>
    </li>
  );
}

/** One numbered stop on the day's route, expandable in place. */
function Stop({
  stop,
  number,
  last,
  open,
  onToggle,
}: {
  stop: PlanStop;
  number: number;
  last: boolean;
  open: boolean;
  onToggle: Props["onToggle"];
}) {
  const panelId = `stop-${stop.id}-details`;
  const empty = !stop.summary && stop.details.length === 0 && !stop.mapHref;
  const chips = stop.area || stop.duration || stop.priority !== null;

  return (
    <li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 pb-4 last:pb-0">
      {/* The dotted leg to the next stop, as on the landing's How it works. */}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[1.25rem] top-11 border-l-2 border-dashed border-sky"
        />
      )}
      <span
        aria-hidden="true"
        className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-tao font-display text-[17px] font-semibold text-paper"
      >
        {number}
      </span>

      <div className="min-w-0 rounded-2xl bg-paper ring-1 ring-rule/70">
        <h3 className="m-0">
          <button
            type="button"
            onClick={() => onToggle(stop.id)}
            aria-expanded={open}
            aria-controls={panelId}
            className={cn(
              "flex w-full cursor-pointer items-start justify-between gap-3 rounded-2xl px-4 py-3.5 text-left",
              "transition-colors hover:bg-tao-wash/60",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tao",
            )}
          >
            <span className="min-w-0">
              <span className="block font-display text-[20px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                {stop.name}
              </span>
              {chips && (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {stop.area && <AreaChip area={stop.area} />}
                  {stop.duration && <span className={SOFT_CHIP}>{stop.duration}</span>}
                  <PriorityChip stop={stop} />
                </span>
              )}
            </span>
            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tao-wash text-tao">
              <ChevronIcon
                size={14}
                className={cn("motion-safe:transition-transform", open && "rotate-180")}
              />
            </span>
          </button>
        </h3>

        <div id={panelId} hidden={!open} className="px-4 pb-4">
          <div className="rule-fade mb-3" />
          {empty ? (
            <p className="m-0 text-[14px] text-ink-subtle">No further details recorded.</p>
          ) : (
            <>
              {stop.summary && (
                <p className="m-0 text-[15px] leading-relaxed text-ink-muted">{stop.summary}</p>
              )}
              {stop.details.length > 0 && (
                <dl className="m-0 mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl bg-paper-raised px-3 py-2.5 text-[14px]">
                  {stop.details.map((d) => (
                    <div key={d.label} className="contents">
                      <dt className="text-ink-subtle">{d.label}</dt>
                      <dd className="m-0 text-ink">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {stop.mapHref && (
                <a
                  href={stop.mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-tao underline-offset-4 hover:underline"
                >
                  <PinIcon size={13} />
                  Open in Maps<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Pure. Holds no state and never calls `showModal` itself.
 *
 * The `<dialog>` rules from `ActivityBankView` apply here too: display
 * utilities are `open:`-prefixed, the ground is set explicitly, and padding
 * lives on the inner sections so a backdrop click is a click on the element.
 *
 * Below `sm` the dialog is a full-screen sheet (`h-dvh`, no radius, the UA's
 * max sizes cleared); above it, a centred panel sized to its content
 * (`h-fit`: a fixed box with `inset: 0` and `height: auto` would stretch).
 * The entrance is motion-safe only, so reduced motion gets it without movement.
 */
export default function DayPlannerView({
  days,
  index,
  expanded,
  range,
  atStart,
  atEnd,
  dialogRef,
  scrollerRef,
  cardRef,
  onScroll,
  onPage,
  onCardKey,
  onOpen,
  onDismiss,
  onClose,
  onStep,
  onToggle,
}: Props) {
  const day = days[index];
  const prev = days[index - 1];
  const next = days[index + 1];

  return (
    <>
      {/* The carousel: native horizontal scroll with snap, so swipe, trackpad
          and focus-into-view all work without a library. The track is padded
          and pulled back by the same amount so focus rings and shadows are
          not clipped by its overflow. */}
      <section aria-roledescription="carousel" aria-label="Days">
        <div className="mb-4 flex items-center justify-end gap-3">
          <p className="m-0 mr-auto text-[13px] font-medium text-ink-muted" aria-live="polite">
            {formatRange(range.first, range.last, days.length)}
          </p>
          <button
            type="button"
            onClick={() => onPage(-1)}
            aria-disabled={atStart}
            aria-controls="day-track"
            aria-label="Previous days"
            className={cn(ARROW, EDGE)}
          >
            <ChevronIcon size={16} className="rotate-90" />
          </button>
          <button
            type="button"
            onClick={() => onPage(1)}
            aria-disabled={atEnd}
            aria-controls="day-track"
            aria-label="Next days"
            className={cn(ARROW, EDGE)}
          >
            <ChevronIcon size={16} className="-rotate-90" />
          </button>
        </div>

        <ol
          id="day-track"
          ref={scrollerRef}
          onScroll={onScroll}
          className={cn(
            "relative -mx-3 -mb-6 -mt-4 flex list-none gap-4 overflow-x-auto px-3 pb-6 pt-4",
            "snap-x snap-mandatory scroll-px-3 motion-safe:scroll-smooth overscroll-x-contain",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {days.map((d, i) => (
            <DayCard
              key={d.id}
              day={d}
              index={i}
              total={days.length}
              cardRef={cardRef}
              onKey={onCardKey}
              onOpen={onOpen}
            />
          ))}
        </ol>
      </section>

      <dialog
        ref={dialogRef}
        onClose={onClose}
        onClick={(event) => {
          if (event.target === dialogRef.current) onDismiss();
        }}
        aria-modal="true"
        aria-labelledby="day-dialog-title"
        aria-describedby="day-dialog-date"
        className={cn(
          "m-0 h-dvh max-h-none w-full max-w-none overflow-hidden rounded-none border-0 bg-paper p-0 font-tao text-ink backdrop:bg-ink/60",
          "sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-6rem)] sm:w-[42rem] sm:max-w-[calc(100vw-2rem)] sm:rounded-3xl sm:ring-1 sm:ring-paper/20",
          "open:flex open:flex-col motion-safe:open:animate-sheet-in",
        )}
      >
        {day && (
          <>
            {/* Navy header, as on the page: white and sky on ink are AA. */}
            <div className="relative flex shrink-0 items-start justify-between gap-4 overflow-hidden bg-ink px-6 pb-6 pt-6 text-paper">
              <RouteMotif tone="dark" className="absolute -bottom-8 right-2 w-48 opacity-40" />
              <div className="relative min-w-0">
                <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.14em] text-sky">
                  Day {day.number} of {days.length}
                </p>
                <h2
                  id="day-dialog-title"
                  className="m-0 mt-2 font-display text-[clamp(1.75rem,5vw,2.25rem)] font-semibold leading-tight tracking-[-0.015em] text-paper"
                >
                  {day.heading}
                </h2>
                <p id="day-dialog-date" className="m-0 mt-1.5 text-[15px] text-paper/80">
                  {day.spokenDate} · {stopCount(day.stops.length)}
                </p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Close day"
                className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-paper/80 transition-colors hover:bg-paper/10 hover:text-paper focus-visible:outline-2 focus-visible:outline-sky"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain bg-sky/10 px-5 py-6 sm:px-6">
              {day.stops.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <RouteMotif className="w-48 opacity-70" />
                  <p className="m-0 mt-3 text-[15px] leading-relaxed text-ink-muted">
                    Nothing planned for this day yet.
                  </p>
                </div>
              ) : (
                <ol className="m-0 list-none p-0" aria-label={`Stops on ${day.title}`}>
                  {day.stops.map((stop, i) => (
                    <Stop
                      key={stop.id}
                      stop={stop}
                      number={i + 1}
                      last={i === day.stops.length - 1}
                      open={expanded.has(stop.id)}
                      onToggle={onToggle}
                    />
                  ))}
                </ol>
              )}
            </div>

            {/* In-control separator, so it stays square. */}
            {days.length > 1 && (
              <nav
                aria-label="Other days"
                className="flex shrink-0 items-center justify-between gap-3 border-t border-rule bg-paper px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
              >
                <button
                  type="button"
                  onClick={() => onStep(-1)}
                  aria-disabled={!prev}
                  className={buttonStyles({ variant: "tao", size: "sm", className: EDGE })}
                >
                  <span aria-hidden="true">←</span>
                  <span>
                    Previous<span className="sr-only"> day{prev ? `: ${prev.title}` : ""}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onStep(1)}
                  aria-disabled={!next}
                  className={buttonStyles({ variant: "tao", size: "sm", className: EDGE })}
                >
                  <span>
                    Next<span className="sr-only"> day{next ? `: ${next.title}` : ""}</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              </nav>
            )}
            <p className="sr-only" role="status">
              Showing day {day.number}: {day.title}
            </p>
          </>
        )}
      </dialog>
    </>
  );
}
