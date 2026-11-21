import { buttonStyles } from "@/components/ui/Button";
import { DATE_FIELD, FIELD, LABEL } from "./fieldStyles";

interface Props {
  /** `useActionState`'s dispatch, handed straight to the `<form>`. */
  action: (formData: FormData) => void;
  name: string;
  startDate: string;
  endDate: string;
  onNameChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  /** All three fields are filled. The rule as an affordance, not a rejection. */
  canSubmit: boolean;
  pending: boolean;
  error: string | null;
}

/**
 * Pure. Holds no state, knows nothing about the action it is given.
 *
 * The two date fields are native `<input type="date">` — that control *is*
 * the calendar dropdown the wireframe asks for, with nothing to install.
 */
export default function NewTripFormView({
  action,
  name,
  startDate,
  endDate,
  onNameChange,
  onStartDateChange,
  onEndDateChange,
  canSubmit,
  pending,
  error,
}: Props) {
  return (
    <form
      action={action}
      className="rounded-2xl border border-rule bg-paper-raised p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-5">
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
            className={FIELD}
          />
        </div>

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
            /* The picker cannot offer a date the server would reject. */
            min={startDate || undefined}
            onChange={(e) => onEndDateChange(e.target.value)}
            disabled={pending}
            className={DATE_FIELD}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p
          className="m-0 text-[13px] leading-relaxed text-ember"
          role="status"
          aria-live="polite"
        >
          {error}
        </p>
        <button
          type="submit"
          disabled={!canSubmit || pending}
          className={buttonStyles({ variant: "tao", size: "md" })}
        >
          {pending ? "Creating…" : "Create trip"}
        </button>
      </div>
    </form>
  );
}
