import Link from "next/link";
import { cn } from "@/lib/cn";
import { eyebrow, focusRing } from "@/components/landing/styles";
import { formatDateRange } from "@/lib/itinerary/format";
import type { Trip } from "@/lib/itinerary/types";

interface Props {
  trips: Trip[];
}

/** The landing's calendar line icon, in a sky badge like its benefit cards. */
function CalendarBadge() {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky/20 text-tao">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
    </span>
  );
}

const HEADING =
  "m-0 mt-3 text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink";

/**
 * Pure, and deliberately not a client component. With no trips it renders a
 * quiet placeholder in the same slot, so a first-time visitor learns where
 * their trips will gather instead of meeting a blank page under the form.
 */
export default function TripList({ trips }: Props) {
  if (trips.length === 0) {
    return (
      <section aria-labelledby="trips-heading" className="py-16 sm:py-20">
        <p className={eyebrow}>Your trips</p>
        <h2 id="trips-heading" className={HEADING}>
          Nothing here yet.
        </h2>
        <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-sky/60 bg-sky/10 px-6 py-12 text-center sm:py-14">
          <CalendarBadge />
          <p className="m-0 mt-5 text-[17px] font-semibold tracking-tight text-ink">
            No trips yet
          </p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[15px] leading-relaxed text-ink-muted">
            Name one and set its dates above. It will wait here, ready to
            reopen, whenever you come back.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="trips-heading" className="py-16 sm:py-20">
      <p className={eyebrow}>Your trips</p>
      <h2 id="trips-heading" className={HEADING}>
        Pick up where you left off.
      </h2>

      <ul className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {trips.map((trip) => (
          <li key={trip.id}>
            <Link
              href={`/plan/${trip.id}`}
              className={cn(
                "group flex items-center gap-4 rounded-3xl border border-rule/70 bg-paper p-5 no-underline transition-colors hover:border-sky",
                focusRing,
              )}
            >
              <CalendarBadge />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold tracking-tight text-ink">
                  {trip.name}
                </span>
                <span className="mt-0.5 block text-[14px] text-ink-muted">
                  {formatDateRange(trip.startDate, trip.endDate)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="text-[18px] text-tao transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
