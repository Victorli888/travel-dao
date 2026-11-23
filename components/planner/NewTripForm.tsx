"use client";

import { useActionState, useState } from "react";
import NewTripFormView from "./NewTripFormView";
import { createTripAction } from "@/app/plan/actions";

/**
 * Owns form-local state and the request lifecycle. Rendering belongs to
 * `NewTripFormView`.
 *
 * The three field values are mirrored in state only to decide whether the
 * submit button is live. The values the server reads come from the
 * `FormData` the `<form>` posts, not from here — so the two cannot disagree.
 */
export default function NewTripForm() {
  // Inline, not imported: `actions.ts` carries `"use server"` and may export
  // only async functions.
  const [state, action, pending] = useActionState(createTripAction, {
    error: null,
  });

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  return (
    <NewTripFormView
      action={action}
      name={name}
      startDate={startDate}
      endDate={endDate}
      onNameChange={setName}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      canSubmit={Boolean(name.trim() && startDate && endDate)}
      pending={pending}
      error={state.error}
    />
  );
}
