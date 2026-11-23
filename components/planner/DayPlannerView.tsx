import type { RefObject } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { ChevronIcon, XIcon } from "@/components/ui/icons";
import { eyebrow, focusRing } from "@/components/landing/styles";
import { cn } from "@/lib/cn";
import type { PlanDay, PlanStop } from "@/lib/itinerary/day-plan";

interface Props {
  days: PlanDay[];
  /** The day the dialog holds. Meaningless while it is closed. */
  index: number;
  /** Stop ids expanded in the dialog. */
  expanded: ReadonlySet<string>;
  dialogRef: RefObject<HTMLDialogElement | null>;
  cardRef: (index: number, el: HTMLButtonElement | null) => void;
  onOpen: (index: number) => void;
  /** Closes the dialog. Shared by ✕ and a backdrop click. */
  onDismiss: () => void;
  /** The dialog's own `close` event — Esc arrives here and nowhere else. */
  onClose: () => void;
  onStep: (delta: -1 | 1) => void;
  onToggle: (stopId: string) => void;
}

const PREVIEW = 3;

/**
 * `aria-disabled`, not `disabled`, on next/previous: stepping onto the last
 * day would otherwise disable the very button holding focus and drop focus to
 * the dialog body. The container already ignores a step past either end.
 */
const EDGE = "aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:bg-transparent";

function stopCount(n: number): string {
  return `${n} ${n === 1 ? "stop" : "stops"}`;
}

/** The overview: one calm card per day, a button that opens the dialog. */
function DayCard({
  day,
  index,
  cardRef,
  onOpen,
}: {
  day: PlanDay;
  index: number;
  cardRef: Props["cardRef"];
  onOpen: Props["onOpen"];
}) {
  const extra = day.stops.length - PREVIEW;
  return (
    <li className="min-w-0">
      <button
        type="button"
        ref={(el) => cardRef(index, el)}
        onClick={() => onOpen(index)}
        aria-haspopup="dialog"
        className={cn(
          "group flex h-full min-h-[13.5rem] w-full cursor-pointer flex-col rounded-3xl border border-rule/70 bg-paper p-6 text-left",
          "transition-colors hover:border-tao/60",
          focusRing,
        )}
      >
        <span className={eyebrow}>Day {day.number}</span>
        <span className="mt-2 text-[19px] font-semibold tracking-tight text-ink">
          {day.title}
        </span>
        {day.dateLabel && (
          <span className="mt-0.5 text-[13px] text-ink-subtle">{day.dateLabel}</span>
        )}

        {day.stops.length === 0 ? (
          <span className="mt-5 text-[15px] leading-relaxed text-ink-subtle">
            Nothing planned yet.
          </span>
        ) : (
          <ol className="m-0 mt-5 list-none space-y-2 p-0">
            {day.stops.slice(0, PREVIEW).map((stop, i) => (
              <li key={stop.id} className="flex items-baseline gap-3 text-[15px] text-ink">
                <span aria-hidden="true" className="w-4 shrink-0 text-[13px] font-semibold text-tao-soft">
                  {i + 1}
                </span>
                <span className="truncate">{stop.name}</span>
              </li>
            ))}
            {extra > 0 && (
              <li className="pl-7 text-[13px] text-ink-subtle">+{extra} more</li>
            )}
          </ol>
        )}

        <span className="mt-auto flex items-center justify-between pt-6 text-[13px]">
          <span className="text-ink-subtle">
            {stopCount(day.stops.length)}
          </span>
          <span className="font-medium text-tao group-hover:text-tao-bright">
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
  const meta = [stop.area, stop.duration].filter(Boolean).join(" · ");
  const empty = !stop.summary && stop.details.length === 0 && !stop.mapHref;

  return (
    <li className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 pb-4 last:pb-0">
      {/* The dotted leg to the next stop, as on the landing's How it works. */}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[1.125rem] top-10 border-l-2 border-dashed border-tao/35"
        />
      )}
      <span
        aria-hidden="true"
        className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-tao bg-paper text-[14px] font-semibold text-tao"
      >
        {number}
      </span>

      <div className="min-w-0 rounded-2xl border border-rule/70 bg-paper">
        <h3 className="m-0">
          <button
            type="button"
            onClick={() => onToggle(stop.id)}
            aria-expanded={open}
            aria-controls={panelId}
            className={cn(
              "flex w-full cursor-pointer items-start justify-between gap-3 rounded-2xl px-4 py-3 text-left",
              "transition-colors hover:bg-tao-wash/60",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tao",
            )}
          >
            <span className="min-w-0">
              <span className="block text-[16px] font-semibold tracking-tight text-ink">
                {stop.name}
              </span>
              {meta && (
                <span className="mt-0.5 block text-[13px] text-ink-subtle">{meta}</span>
              )}
            </span>
            <ChevronIcon
              size={16}
              className={cn(
                "mt-1 shrink-0 text-tao motion-safe:transition-transform",
                open && "rotate-180",
              )}
            />
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
                <dl className="m-0 mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14px]">
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
                  className="mt-3 inline-block text-[14px] font-medium text-tao underline-offset-4 hover:underline"
                >
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
 * max sizes cleared); above it, a centred panel. The entrance is motion-safe
 * only, so reduced motion gets it without movement.
 */
export default function DayPlannerView({
  days,
  index,
  expanded,
  dialogRef,
  cardRef,
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
      <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((d, i) => (
          <DayCard key={d.id} day={d} index={i} cardRef={cardRef} onOpen={onOpen} />
        ))}
      </ol>

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
          "m-0 h-dvh max-h-none w-full max-w-none rounded-none border-0 bg-paper p-0 font-tao text-ink backdrop:bg-ink/50",
          "sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-6rem)] sm:w-[40rem] sm:max-w-[calc(100vw-2rem)] sm:rounded-3xl sm:border sm:border-rule",
          "open:flex open:flex-col motion-safe:open:animate-sheet-in",
        )}
      >
        {day && (
          <>
            <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-6">
              <div className="min-w-0">
                <p className={eyebrow}>
                  Day {day.number} of {days.length}
                </p>
                <h2
                  id="day-dialog-title"
                  className="m-0 mt-2 text-[clamp(1.5rem,4vw,1.875rem)] font-semibold leading-tight tracking-[-0.02em] text-ink"
                >
                  {day.title}
                </h2>
                <p id="day-dialog-date" className="m-0 mt-1 text-[15px] text-ink-muted">
                  {day.spokenDate} · {stopCount(day.stops.length)}
                </p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Close day"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-tao-wash hover:text-tao focus-visible:outline-2 focus-visible:outline-tao"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="rule-fade mx-6" />

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6">
              {day.stops.length === 0 ? (
                <p className="m-0 text-[15px] leading-relaxed text-ink-muted">
                  Nothing planned for this day yet.
                </p>
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
                className="flex items-center justify-between gap-3 border-t border-rule px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
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
