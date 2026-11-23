import Link from "next/link";
import type { RefObject } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { XIcon } from "@/components/ui/icons";
import { formatBankMeta, type BankCounts, type BankEntry } from "@/lib/itinerary/bank";
import { FIELD } from "./fieldStyles";

interface Props {
  /** The container owns the handles; the view only attaches them. */
  dialogRef: RefObject<HTMLDialogElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
  onOpen: () => void;
  /** Closes the dialog. Shared by ✕, Done and a backdrop click. */
  onDismiss: () => void;
  /** The dialog's own `close` event — Esc arrives here and nowhere else. */
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  /** Already filtered. */
  entries: BankEntry[];
  /** Unfiltered totals: the meta line describes the bank, not the search. */
  counts: BankCounts;
  /** Trip-scoped research entry point. */
  addHref: string;
}

/**
 * Pure. Holds no state and never calls `showModal` itself.
 *
 * Three things about `<dialog>` are load-bearing here and easy to undo by
 * accident:
 *
 * - **Every display utility is `open:`-prefixed.** A bare `flex` outranks the
 *   UA's `dialog:not([open]) { display: none }` and pins the dialog open.
 * - **The ground is set explicitly.** The UA sheet paints `dialog` with
 *   `Canvas`/`CanvasText`, so `.tao-ground` does not reach in; `::backdrop`
 *   inherits nothing either, hence `backdrop:`.
 * - **Padding lives on the inner sections, not the dialog.** A click on the
 *   dim area targets the `<dialog>` element itself, and padding would make the
 *   panel's own margin read as a backdrop click.
 */
export default function ActivityBankView({
  dialogRef,
  searchRef,
  onOpen,
  onDismiss,
  onClose,
  query,
  onQueryChange,
  entries,
  counts,
  addHref,
}: Props) {
  const empty = counts.saved === 0;

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className={buttonStyles({ variant: "tao", size: "sm" })}
      >
        Activity bank
      </button>

      <dialog
        ref={dialogRef}
        onClose={onClose}
        onClick={(event) => {
          if (event.target === dialogRef.current) onDismiss();
        }}
        aria-labelledby="activity-bank-title"
        className="m-0 mx-auto mt-12 w-[45rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-rule bg-paper p-0 font-tao text-ink backdrop:bg-ink/50 open:flex open:max-h-[calc(100vh-6rem)] open:flex-col"
      >
        <div className="flex items-baseline justify-between gap-4 px-6 pt-6">
          <h2
            id="activity-bank-title"
            className="m-0 shrink-0 text-[17px] font-medium tracking-tight text-ink"
          >
            Activity bank
          </h2>
          <span className="ml-auto text-right text-[12px] text-ink-subtle">
            {formatBankMeta(counts)}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close the activity bank"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-tao-wash hover:text-tao"
          >
            <XIcon />
          </button>
        </div>

        {/* Nothing to search is nothing to search — a disabled field here would
            be a dead control, the same reason the placing affordances are out. */}
        {!empty && (
          <div className="px-6 pt-4">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search the bank"
              aria-label="Search the bank"
              className={FIELD}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {empty ? (
            <p className="m-0 text-[15px] leading-relaxed text-ink-muted">
              Nothing saved to this trip yet.{" "}
              <Link
                href={addHref}
                className="font-medium text-tao underline-offset-4 transition-colors hover:text-ember"
              >
                Research a place
              </Link>{" "}
              to add one.
            </p>
          ) : entries.length === 0 ? (
            <p className="m-0 text-[15px] leading-relaxed text-ink-muted">
              No match for “{query.trim()}”.
            </p>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="min-w-0 rounded-xl border border-rule bg-paper-raised px-3 py-2.5"
                >
                  <span className="block truncate text-[14px] font-medium tracking-tight text-ink">
                    {entry.name}
                  </span>
                  {/* NULL means the area was never recorded — omit the line
                      rather than filling it with a placeholder. */}
                  {entry.area && (
                    <span
                      title={entry.area}
                      className="mt-0.5 block truncate text-[12px] text-ink-subtle"
                    >
                      {entry.area}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="sr-only" role="status">
            {entries.length} of {counts.saved} shown
          </p>
        </div>

        {/* In-control separator, so it stays square — `.rule-fade` is for
            freestanding rules. */}
        <div className="flex items-center justify-between gap-4 border-t border-rule px-6 py-4">
          <Link
            href={addHref}
            className="text-[12px] font-medium text-tao underline-offset-4 transition-colors hover:text-ember"
          >
            + Add activity
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className={buttonStyles({ variant: "tao", size: "sm" })}
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
