import Link from "next/link";
import NewTripForm from "@/components/planner/NewTripForm";
import TripList from "@/components/planner/TripList";
import { requireUserEmail } from "@/lib/auth/session";
import { listTrips } from "@/lib/itinerary";

/**
 * Frame 0: name a trip and set its two dates. Submitting creates the trip and
 * opens `/plan/[tripId]`, where the rest of the planner will land.
 *
 * The shell matches the landing's exactly — same ground, same 72rem column —
 * so crossing from the marketing page into the app does not move anything.
 */
export default async function PlanPage() {
  const email = await requireUserEmail();
  const trips = await listTrips(email);

  return (
    <main className="tao-ground min-h-screen font-tao">
      <div className="mx-auto w-full max-w-[72rem] px-5 sm:px-8">
        <nav className="flex items-baseline justify-between gap-6 py-6">
          <Link href="/" className="flex items-baseline gap-2 no-underline">
            <span className="text-[17px] font-medium tracking-tight text-ink">
              Travel Tao
            </span>
            <span className="text-[15px] text-tao-soft">道</span>
          </Link>
        </nav>

        <header className="pb-8 pt-6 sm:pb-10 sm:pt-10">
          <h1 className="m-0 max-w-[20ch] text-[clamp(1.9rem,4.5vw,2.75rem)] font-medium leading-[1.1] tracking-[-0.025em] text-ink">
            Name the trip. Set the dates.
          </h1>
          <p className="mt-4 max-w-[54ch] text-[16px] leading-relaxed text-ink-muted">
            Travel Tao lays out a column for every day between them, waiting to
            be filled.
          </p>
        </header>

        <div className="pb-14">
          <NewTripForm />
        </div>

        <TripList trips={trips} />
      </div>
    </main>
  );
}
