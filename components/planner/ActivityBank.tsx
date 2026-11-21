"use client";

import { useRef, useState } from "react";
import ActivityBankView from "./ActivityBankView";
import {
  filterBankEntries,
  type BankCounts,
  type BankEntry,
} from "@/lib/itinerary/bank";

interface Props {
  /** Shaped on the server — the view never touches an `Activity`. */
  entries: BankEntry[];
  counts: BankCounts;
}

/**
 * The second container in `components/planner/`, on the same terms as
 * `NewTripForm`: a draft search string and two imperative refs, nothing more.
 *
 * **There is no React `open` flag.** The dialog's openness lives in the DOM,
 * where `showModal()` and Esc both write it; mirroring it in state would give
 * the two a way to disagree. `onClose` is the single point every dismissal
 * passes through, so the search resets identically whether you pressed Esc,
 * Done, ✕ or the backdrop.
 *
 * `bank.ts` is imported by path, not through `@/lib/itinerary` — that barrel
 * carries `server-only` and would fail here at runtime.
 */
export default function ActivityBank({ entries, counts }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  function open() {
    dialogRef.current?.showModal();
    // The dialog is already mounted, so this is a plain call rather than an
    // effect — but focus has to wait for the browser to promote it to the top
    // layer.
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  return (
    <ActivityBankView
      dialogRef={dialogRef}
      searchRef={searchRef}
      onOpen={open}
      onDismiss={() => dialogRef.current?.close()}
      onClose={() => setQuery("")}
      query={query}
      onQueryChange={setQuery}
      entries={filterBankEntries(entries, query)}
      counts={counts}
    />
  );
}
