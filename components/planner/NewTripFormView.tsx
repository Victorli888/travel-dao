import type { ReactNode } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { NewTripField } from "@/app/plan/actions";
import {
  formatDateRange,
  formatDayCount,
  formatDayLabel,
} from "@/lib/itinerary/format";
import { focusRing } from "@/components/landing/styles";
import {
  DATE_FIELD,
  ERROR_TEXT,
  FIELD,
  HINT_TEXT,
  LABEL,
} from "./fieldStyles";

/** The one error on the form, and the field it belongs to (`null`: none). */
export interface FieldMessage {
  field: NewTripField | null;
  text: string;
}

/** Return was carried forward when Departure moved past it. */
export interface ReturnBump {
  to: string;
  days: number;
}

const PRESETS = [
  { label: "Weekend", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
] as const;

const MISSING_NAMES: Record<NewTripField, string> = {
  name: "a trip name",
  startDate: "a departure date",
  endDate: "a return date",
};

interface Props {
  /** `useActionState`'s dispatch, handed straight to the `<form>`. */
  action: (formData: FormData) => void;
  name: string;
  startDate: string;
  endDate: string;
  onNameChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  /** Sets Return to Departure + `days - 1`. */
  onPreset: (days: number) => void;
  /** Inclusive day count, `null` while incomplete or reversed. */
  length: number | null;
  pastDeparture: boolean;
  longTrip: boolean;
  bump: ReturnBump | null;
  message: FieldMessage | null;
  messageIds: Record<NewTripField, string>;
  /** Fields still empty, in form order. Drives the disabled-button hint. */
  missing: NewTripField[];
  canSubmit: boolean;
  pending: boolean;
  /** The desktop range picker. Hidden on touch screens, where the native inputs show. */
  picker: ReactNode;
}

/** "a, b and c". */
function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** 16px glyphs stroked in `currentColor`, after the landing's line icons. */
function InfoGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-px h-4 w-4 shrink-0 text-tao" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v3.5M8 5.1v.01" />
    </svg>
  );
}

/** Filled, so an error reads differently from a hint without a new colour. */
function AlertGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-px h-4 w-4 shrink-0">
      <circle cx="8" cy="8" r="7" className="fill-ink" />
      <path d="M8 4.5v4.25M8 11.2v.01" className="stroke-paper" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Pure. Holds no state, knows nothing about the action it is given.
 *
 * Dates have two controls each. With a mouse, `picker` shows one calendar
 * for both ends. On a touch screen (`pointer: coarse`) the native
 * `<input type="date">` shows instead, because the OS wheel or sheet beats
 * any custom grid at that size. The native inputs are the ones carrying
 * `name`, and they stay in the form while hidden — `display: none` does not
 * drop a field from `FormData`, only `disabled` does — so the posted values
 * are the same on every device.
 */
export default function NewTripFormView({
  action,
  name,
  startDate,
  endDate,
  onNameChange,
  onStartDateChange,
  onEndDateChange,
  onPreset,
  length,
  pastDeparture,
  longTrip,
  bump,
  message,
  messageIds,
  missing,
  canSubmit,
  pending,
  picker,
}: Props) {
  const errorOn = (field: NewTripField) => message?.field === field;
  const describe = (field: NewTripField, alsoWhen = false) =>
    errorOn(field) || alsoWhen ? messageIds[field] : undefined;

  const hint = pending
    ? null
    : missing.length > 0
      ? `Add ${listOf(missing.map((f) => MISSING_NAMES[f]))} to create the trip.`
      : !canSubmit
        ? "Fix the return date to create the trip."
        : null;

  return (
    <form
      action={action}
      noValidate
      className="rounded-3xl border border-rule/70 bg-paper p-6 shadow-[0_24px_60px_-32px] shadow-tao/30 sm:p-9"
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)] sm:gap-6">
        <div>
          <label className={LABEL} htmlFor="trip-name">
            Trip
          </label>
          <input
            id="trip-name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Japan, spring"
            maxLength={200}
            disabled={pending}
            aria-invalid={errorOn("name") || undefined}
            aria-describedby={describe("name")}
            className={FIELD}
          />
          {errorOn("name") && (
            <p id={messageIds.name} className={ERROR_TEXT}>
              <AlertGlyph />
              {message!.text}
            </p>
          )}
        </div>

        <div>
          <div className="pointer-coarse:hidden">{picker}</div>

          <div className="hidden grid-cols-2 gap-3 pointer-coarse:grid sm:gap-4">
            <div>
              <label className={LABEL} htmlFor="trip-start">
                Departure
              </label>
              <input
                id="trip-start"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                disabled={pending}
                aria-invalid={errorOn("startDate") || undefined}
                aria-describedby={describe("startDate", pastDeparture)}
                className={DATE_FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="trip-end">
                Return
              </label>
              <input
                id="trip-end"
                name="endDate"
                type="date"
                value={endDate}
                /* The native picker cannot offer a date before Departure. */
                min={startDate || undefined}
                onChange={(e) => onEndDateChange(e.target.value)}
                disabled={pending}
                aria-invalid={errorOn("endDate") || undefined}
                aria-describedby={describe("endDate", Boolean(bump))}
                className={DATE_FIELD}
              />
            </div>
          </div>

          {/* Each end's message sits under its own column. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div id={messageIds.startDate}>
              {errorOn("startDate") ? (
                <p className={ERROR_TEXT}>
                  <AlertGlyph />
                  {message!.text}
                </p>
              ) : pastDeparture ? (
                <p className={HINT_TEXT}>
                  <InfoGlyph />
                  <span>That&apos;s in the past. Fine for a trip you&apos;ve taken.</span>
                </p>
              ) : null}
            </div>
            <div id={messageIds.endDate}>
              {errorOn("endDate") ? (
                <p className={ERROR_TEXT}>
                  <AlertGlyph />
                  {message!.text}
                </p>
              ) : bump ? (
                <p className={HINT_TEXT}>
                  <InfoGlyph />
                  <span>
                    Moved to {formatDayLabel(bump.to)} to keep{" "}
                    {formatDayCount(bump.days)}.
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-5 rounded-2xl border border-sky/30 bg-sky/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky/25 text-tao">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
          </span>
          <p className="m-0 text-[14px] leading-snug text-ink-muted" aria-live="polite">
            {length !== null ? (
              <>
                <span className="block text-[20px] font-semibold tracking-tight text-ink">
                  {formatDayCount(length)}
                </span>
                <span className="sr-only">, </span>
                {formatDateRange(startDate, endDate)}
              </>
            ) : (
              <>
                <span className="block text-[15px] font-semibold text-ink">
                  Trip length
                </span>
                Pick both dates to see how long the trip runs.
              </>
            )}
          </p>
        </div>

        <div
          role="group"
          aria-label="Set the trip length from departure"
          className="grid grid-cols-3 gap-2 sm:flex sm:justify-end"
        >
          {PRESETS.map((preset) => (
            <button
              key={preset.days}
              type="button"
              onClick={() => onPreset(preset.days)}
              disabled={!startDate || pending}
              aria-pressed={length === preset.days}
              title={
                startDate
                  ? `${formatDayCount(preset.days)} from departure`
                  : "Pick a departure date first"
              }
              className={cn(
                "cursor-pointer whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-4",
                focusRing,
                length === preset.days
                  ? "border-tao bg-tao text-paper"
                  : "border-rule/70 bg-paper text-tao enabled:hover:border-sky enabled:hover:bg-sky/15",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {longTrip && length !== null && (
        <p className={cn(HINT_TEXT, "mt-4")}>
          <InfoGlyph />
          <span>
            {formatDayCount(length)} is a long trip, so that&apos;s {length}{" "}
            columns to fill. Worth a second look at Return.
          </span>
        </p>
      )}

      {/* One polite live region announces whichever error is current. A
          message tied to a field renders visibly under that field and only
          for screen readers here; one tied to no field renders here. */}
      <div role="status" aria-live="polite">
        {message &&
          (message.field === null ? (
            <p className={cn(ERROR_TEXT, "mt-5")}>
              <AlertGlyph />
              {message.text}
            </p>
          ) : (
            <span className="sr-only">{message.text}</span>
          ))}
      </div>

      <div className="mt-7 flex flex-col-reverse gap-3 border-t border-rule/70 pt-6 sm:flex-row sm:items-center sm:justify-end sm:gap-5">
        {hint && (
          <p id="create-trip-hint" className="m-0 text-[13px] leading-snug text-ink-subtle">
            {hint}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit || pending}
          aria-describedby={hint ? "create-trip-hint" : undefined}
          /* The page's one action, so it takes the landing's one action
             colour: the ember fill with ink text. */
          className={buttonStyles({
            variant: "ember",
            size: "md",
            className: "w-full px-7 sm:w-auto",
          })}
        >
          {pending ? "Creating…" : "Create trip"}
        </button>
      </div>
    </form>
  );
}
