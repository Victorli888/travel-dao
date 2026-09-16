import Link from "next/link";
import { formatDateRange } from "@/lib/itinerary/format";
import type { Trip } from "@/lib/itinerary/types";

interface Props {
  trips: Trip[];
}

/**
 * Pure, and deliberately not a client component. Renders nothing at all when
 * there are no trips, so a first-time visitor sees only the form.
 */
export default function TripList({ trips }: Props) {
  if (trips.length === 0) return null;

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
