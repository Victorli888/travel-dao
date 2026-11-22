import type { ReactNode, RefObject, ToggleEvent } from "react";
import { cn } from "@/lib/cn";
import { formatDayLabel } from "@/lib/itinerary/format";
import { FIELD, LABEL } from "./fieldStyles";

export const POPOVER_ID = "trip-dates-calendar";

interface TriggerProps {
  id: string;
  label: string;
  value: string;
  describedBy: string | undefined;
  disabled: boolean;
  onOpen: () => void;
}

function Trigger({
  id,
  label,
  value,
  describedBy,
  disabled,
  onOpen,
}: TriggerProps) {
  return (
    <div>
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        popoverTarget={POPOVER_ID}
        onClick={onOpen}
        disabled={disabled}
        aria-haspopup="dialog"
        /* No aria-invalid: it is not allowed on role=button. The message is
           tied on with aria-describedby instead. */
        aria-describedby={describedBy}
        className={cn(
          FIELD,
          "flex cursor-pointer items-center justify-between gap-2 text-left",
          !value && "text-ink-subtle/70",
        )}
      >
        <span className="truncate">
          {value ? `${formatDayLabel(value)} ${value.slice(0, 4)}` : "Add date"}
        </span>
        <CalendarGlyph />
      </button>
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0 text-ink-subtle"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

interface Props {
  anchorRef: RefObject<HTMLDivElement | null>;
  popoverRef: RefObject<HTMLDivElement | null>;
  start: string;
  end: string;
  startDescribedBy: string | undefined;
  endDescribedBy: string | undefined;
  disabled: boolean;
  onOpenStart: () => void;
  onOpenEnd: () => void;
  onToggle: (event: ToggleEvent<HTMLDivElement>) => void;
  /** The calendar itself — rendered only while open. */
  children: ReactNode;
}

/**
 * Pure. Two field-shaped triggers that open **one** calendar, and the
 * popover that holds it.
 *
 * The popover is the native `popover="auto"` element, for the reason the
 * Activity Bank uses a native `<dialog>`: the browser owns openness, light
 * dismiss and Esc, so no React flag can disagree with it, and the
 * `popovertarget` invokers get `aria-expanded` for free. Like `<dialog>`, it
 * is painted by the UA (`Canvas`, a border, `inset: 0` with auto margins), so
 * ground, inset and margin are all set explicitly here.
 */
export default function RangeDatePickerView({
  anchorRef,
  popoverRef,
  start,
  end,
  startDescribedBy,
  endDescribedBy,
  disabled,
  onOpenStart,
  onOpenEnd,
  onToggle,
  children,
}: Props) {
  return (
    <>
      <div ref={anchorRef} className="grid grid-cols-2 gap-3 sm:gap-5">
        <Trigger
          id="trip-start-trigger"
          label="Departure"
          value={start}
          describedBy={startDescribedBy}
          disabled={disabled}
          onOpen={onOpenStart}
        />
        <Trigger
          id="trip-end-trigger"
          label="Return"
          value={end}
          describedBy={endDescribedBy}
          disabled={disabled}
          onOpen={onOpenEnd}
        />
      </div>

      <div
        ref={popoverRef}
        id={POPOVER_ID}
        popover="auto"
        role="dialog"
        aria-label="Choose trip dates"
        onToggle={onToggle}
        className="absolute inset-auto m-0 rounded-2xl border border-rule bg-paper p-0 font-tao text-ink shadow-[0_12px_40px_-12px_rgba(7,64,123,0.35)]"
      >
        {children}
      </div>
    </>
  );
}
