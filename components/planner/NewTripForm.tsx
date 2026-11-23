"use client";

import { useActionState, useEffect, useState } from "react";
import NewTripFormView, {
  type FieldMessage,
  type ReturnBump,
} from "./NewTripFormView";
import RangeDatePicker from "./RangeDatePicker";
import {
  createTripAction,
  type NewTripField,
  type NewTripState,
} from "@/app/plan/actions";
import {
  addDays,
  assessTripDates,
  MAX_TRIP_DAYS,
  todayIso,
  tripLength,
} from "@/lib/itinerary/dates";

/** Where each field's message renders, for `aria-describedby`. */
export const MESSAGE_IDS: Record<NewTripField, string> = {
  name: "trip-name-message",
  startDate: "trip-start-message",
  endDate: "trip-end-message",
};

/**
 * Each field has two controls: the native input (shown on touch screens) and
 * the calendar trigger (shown with a mouse). Focus goes to whichever is
 * actually rendered.
 */
const FOCUS_TARGETS: Record<NewTripField, string[]> = {
  name: ["trip-name"],
  startDate: ["trip-start-trigger", "trip-start"],
  endDate: ["trip-end-trigger", "trip-end"],
};

/**
 * Owns form-local state and the request lifecycle. Rendering belongs to
 * `NewTripFormView`.
 *
 * The three values are mirrored in state to drive the summary, the hints and
 * whether submit is live. The values the server reads come from the
 * `FormData` the `<form>` posts — the native inputs are always in the form,
 * named, even while hidden behind the calendar — so the two cannot disagree.
 */
export default function NewTripForm() {
  // Inline, not imported: `actions.ts` carries `"use server"` and may export
  // only async functions.
  const [state, action, pending] = useActionState(createTripAction, {
    error: null,
    field: null,
  });

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  /** Set when moving Departure pushed Return along with it. */
  const [bump, setBump] = useState<ReturnBump | null>(null);
  /**
   * The server result the user has since edited past. A stale "give the trip
   * a name" under a field that now has one is worse than no message.
   */
  const [seen, setSeen] = useState<NewTripState | null>(null);

  const serverError = state.error && state !== seen ? state : null;

  // Move focus to the field the server named — or, failing that, the first
  // field — once per result.
  useEffect(() => {
    if (!state.error) return;
    const ids = FOCUS_TARGETS[state.field ?? "name"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) {
        el.focus();
        return;
      }
    }
  }, [state]);

  function edited() {
    if (state.error) setSeen(state);
  }

  function changeStart(next: string) {
    edited();
    // If Departure passes Return, carry Return along so the trip keeps its
    // length — the user moved the trip, not shortened it. With no usable
    // length to keep, Return lands on the new Departure.
    if (next && endDate && endDate < next) {
      const kept = tripLength(startDate, endDate) ?? 1;
      const moved = addDays(next, kept - 1);
      setEndDate(moved);
      setBump({ to: moved, days: kept });
    } else {
      setBump(null);
    }
    setStartDate(next);
  }

  function changeEnd(next: string) {
    edited();
    setBump(null);
    setEndDate(next);
  }

  function applyPreset(days: number) {
    if (!startDate) return;
    changeEnd(addDays(startDate, days - 1));
  }

  const today = todayIso();
  const dates = assessTripDates(startDate, endDate, today);

  const missing: NewTripField[] = [];
  if (!name.trim()) missing.push("name");
  if (!startDate) missing.push("startDate");
  if (!endDate) missing.push("endDate");

  // Client checks speak first; a server message shows only when they are
  // quiet. Either way there is at most one error on the page, which is what
  // keeps `ember` to one use.
  let message: FieldMessage | null = null;
  if (dates.reversed) {
    message = {
      field: "endDate",
      text: "Return can't be before departure.",
    };
  } else if (dates.tooLong) {
    message = {
      field: "endDate",
      text: `That's ${dates.length} days. A trip can span at most ${MAX_TRIP_DAYS}.`,
    };
  } else if (serverError) {
    message = { field: serverError.field, text: serverError.error! };
  }

  const canSubmit =
    missing.length === 0 && !dates.reversed && !dates.tooLong;

  return (
    <NewTripFormView
      action={action}
      name={name}
      startDate={startDate}
      endDate={endDate}
      onNameChange={(v) => {
        edited();
        setName(v);
      }}
      onStartDateChange={changeStart}
      onEndDateChange={changeEnd}
      onPreset={applyPreset}
      length={dates.length}
      pastDeparture={dates.pastDeparture}
      longTrip={dates.long && !dates.tooLong}
      bump={bump}
      message={message}
      messageIds={MESSAGE_IDS}
      missing={missing}
      canSubmit={canSubmit}
      pending={pending}
      picker={
        <RangeDatePicker
          start={startDate}
          end={endDate}
          onStartChange={changeStart}
          onEndChange={changeEnd}
          startDescribedBy={
            message?.field === "startDate" || dates.pastDeparture
              ? MESSAGE_IDS.startDate
              : undefined
          }
          endDescribedBy={
            message?.field === "endDate" || bump ? MESSAGE_IDS.endDate : undefined
          }
          disabled={pending}
        />
      }
    />
  );
}
