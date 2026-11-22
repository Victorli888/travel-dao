import Link from "next/link";
import { formatDateRange } from "@/lib/itinerary/format";
import type { Trip } from "@/lib/itinerary/types";

interface Props {
  trips: Trip[];
}

/**
 * Pure, and deliberately not a client component. With no trips it renders a
 * quiet placeholder in the same slot, so a first-time visitor learns where
 * their trips will gather instead of meeting a blank page under the form.
 */
export default function TripList({ trips }: Props) {
  if (trips.length === 0) {
    return (
      <section className="pb-16">
        <div className="rule-fade" />
        <div className="mt-8 rounded-2xl border border-dashed border-rule px-5 py-8 text-center sm:py-10">
          <p className="m-0 text-[16px] font-medium tracking-tight text-ink">
            No trips yet
          </p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[14px] leading-relaxed text-ink-subtle">
            Name one and set its dates above. It will wait here, ready to
            reopen, whenever you come back.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="pb-16">
      {/* Freestanding rules fade at both ends — the design system's signature. */}
      <div className="rule-fade" />

      <h2 className="m-0 mb-5 mt-8 text-[13px] font-medium uppercase tracking-[0.07em] text-ink-subtle">
        Or pick up where you left off
      </h2>

      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((trip) => (
          <li key={trip.id}>
            <Link
              href={`/plan/${trip.id}`}
              className="block rounded-2xl border border-rule bg-paper-raised px-5 py-4 no-underline transition-colors hover:border-tao hover:bg-tao-wash"
            >
              <span className="block truncate text-[16px] font-medium tracking-tight text-ink">
                {trip.name}
              </span>
              <span className="mt-1 block text-[13px] text-ink-subtle">
                {formatDateRange(trip.startDate, trip.endDate)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
