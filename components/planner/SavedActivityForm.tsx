"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  deleteActivityAction,
  saveActivityAction,
} from "@/app/activity-bank/actions";
import type { ActivityFormState } from "@/app/activity-bank/actions";
import { FIELD, LABEL } from "./fieldStyles";

const INITIAL: ActivityFormState = { error: null, attempt: 0 };
const PRIMARY = "rounded-xl bg-tao px-4 py-2.5 font-medium text-paper hover:bg-tao-bright disabled:opacity-50";
const CANCEL = "text-sm text-ink-muted underline underline-offset-4 hover:text-tao";

const fields = [
  { name: "name", label: "Activity name", maxLength: 200, required: true },
  { name: "country", label: "Country", maxLength: 100 },
  { name: "activityType", label: "Activity type", maxLength: 100 },
  { name: "area", label: "Area or neighbourhood", maxLength: 200 },
  { name: "address", label: "Address", maxLength: 500 },
  { name: "hoursOperation", label: "Opening hours", maxLength: 500 },
  { name: "durationMinutes", label: "Duration in minutes", type: "number", min: 1, max: 2147483647 },
  { name: "priorityScore", label: "Priority (1–5)", type: "number", min: 1, max: 5 },
  { name: "lat", label: "Latitude", type: "number", step: "0.000001", min: -90, max: 90 },
  { name: "lng", label: "Longitude", type: "number", step: "0.000001", min: -180, max: 180 },
] as const;

export function SavedActivityForm({
  activityId,
  defaults,
  trips,
}: {
  activityId: string | null;
  defaults: Record<string, string>;
  trips: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    saveActivityAction.bind(null, activityId),
    INITIAL,
  );
  const values = state.values ?? defaults;

  return (
    <form action={action} className="mt-5 space-y-4">
      {state.error && <p role="alert" className="text-sm text-ink">{state.error}</p>}
      <fieldset key={state.attempt} disabled={pending} className="grid gap-4 sm:grid-cols-2">
        {activityId === null && (
          <label>
            <span className={LABEL}>Trip</span>
            <select className={FIELD} name="tripId" defaultValue={values.tripId ?? ""} required>
              <option value="" disabled>Choose a trip</option>
              {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
            </select>
          </label>
        )}
        {fields.map(({ name, label, ...constraints }) => (
          <label key={name}>
            <span className={LABEL}>{label}</span>
            <input className={FIELD} name={name} defaultValue={values[name] ?? ""} {...constraints} />
          </label>
        ))}
        <label className="sm:col-span-2">
          <span className={LABEL}>Description</span>
          <textarea className={FIELD} name="summary" rows={4} maxLength={2000}
            defaultValue={values.summary ?? ""} required />
        </label>
      </fieldset>
      <div className="flex items-center gap-4">
        <button className={PRIMARY} disabled={pending}>{pending ? "Saving…" : "Save activity"}</button>
        <Link href="/activity-bank" className={CANCEL}>Cancel</Link>
      </div>
    </form>
  );
}

export function DeleteSavedActivityForm({ activityId }: { activityId: string }) {
  const [state, action, pending] = useActionState(
    deleteActivityAction.bind(null, activityId),
    INITIAL,
  );

  return (
    <form action={action} className="mt-4 space-y-4">
      {state.error && <p role="alert" className="text-sm text-ink">{state.error}</p>}
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 accent-tao" />
        I understand this permanently deletes the activity and removes it from every itinerary day where it is scheduled.
      </label>
      <div className="flex items-center gap-4">
        <button className={PRIMARY} disabled={pending}>{pending ? "Deleting…" : "Delete activity"}</button>
        <Link href="/activity-bank" className={CANCEL}>Cancel</Link>
      </div>
    </form>
  );
}
