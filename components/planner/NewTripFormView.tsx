import type { ReactNode } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { NewTripField } from "@/app/plan/actions";
import {
  formatDateRange,
  formatDayCount,
  formatDayLabel,
} from "@/lib/itinerary/format";
import { DATE_FIELD, FIELD, LABEL } from "./fieldStyles";

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

const HINT = "m-0 mt-1.5 text-[13px] leading-snug text-ink-muted";
const ERROR = "m-0 mt-1.5 text-[13px] leading-snug text-ember";

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
      className="rounded-2xl border border-rule bg-paper-raised p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)] sm:gap-5">
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
            <p id={messageIds.name} className={ERROR}>
              {message!.text}
            </p>
          )}
        </div>

        <div>
          <div className="pointer-coarse:hidden">{picker}</div>

          <div className="hidden grid-cols-2 gap-3 pointer-coarse:grid">
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
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            <div id={messageIds.startDate}>
              {errorOn("startDate") ? (
                <p className={ERROR}>{message!.text}</p>
              ) : pastDeparture ? (
                <p className={HINT}>
                  That&apos;s in the past. Fine for a trip you&apos;ve taken.
                </p>
              ) : null}
            </div>
            <div id={messageIds.endDate}>
              {errorOn("endDate") ? (
                <p className={ERROR}>{message!.text}</p>
              ) : bump ? (
                <p className={HINT}>
                  Moved to {formatDayLabel(bump.to)} to keep{" "}
                  {formatDayCount(bump.days)}.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-[14px] text-ink-muted" aria-live="polite">
          {length !== null ? (
            <>
              <span className="font-medium text-ink">
                {formatDayCount(length)}
              </span>
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              {formatDateRange(startDate, endDate)}
            </>
          ) : (
            "Pick both dates to see how long the trip runs."
          )}
        </p>

        <div
          role="group"
          aria-label="Set the trip length from departure"
          className="flex flex-wrap gap-2"
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
                "cursor-pointer rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                length === preset.days
                  ? "border-tao bg-tao-wash text-tao"
                  : "border-rule text-ink-muted enabled:hover:border-tao enabled:hover:text-tao",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {longTrip && length !== null && (
        <p className={HINT}>
          {formatDayCount(length)} is a long trip, so that&apos;s{" "}
          {length} columns to fill. Worth a second look at Return.
        </p>
      )}

      {/* One polite live region announces whichever error is current. A
          message tied to a field renders visibly under that field and only
          for screen readers here; one tied to no field renders here. */}
      <div role="status" aria-live="polite">
        {message &&
          (message.field === null ? (
            <p className="m-0 mt-4 text-[13px] leading-relaxed text-ember">
              {message.text}
            </p>
          ) : (
            <span className="sr-only">{message.text}</span>
          ))}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {hint && (
          <p id="create-trip-hint" className="m-0 text-[13px] text-ink-subtle">
            {hint}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit || pending}
          aria-describedby={hint ? "create-trip-hint" : undefined}
          className={buttonStyles({
            variant: "tao",
            size: "md",
            className: "w-full sm:w-auto",
          })}
        >
          {pending ? "Creating…" : "Create trip"}
        </button>
      </div>
    </form>
  );
}
