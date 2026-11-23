import Link from "next/link";
import NewTripForm from "@/components/planner/NewTripForm";
import TripList from "@/components/planner/TripList";
import LandingFooter from "@/components/landing/LandingFooter";
import { cn } from "@/lib/cn";
import { container, eyebrow, focusRing } from "@/components/landing/styles";
import { requireUserEmail } from "@/lib/auth/session";
import { listTrips } from "@/lib/itinerary";

/**
 * Frame 0: name a trip and set its two dates. Submitting creates the trip and
 * opens `/plan/[tripId]`, where the rest of the planner will land.
 *
 * Built from the landing's parts — same ground, nav, 72rem container, type
 * scale and footer, and its sky band behind the form (the band "How it works"
 * uses) — so crossing from the marketing page into the app changes the
 * content, not the look. Bands bleed full width, so each sets its own
 * container, as on the landing.
 */
export default async function PlanPage() {
  const email = await requireUserEmail();
  const trips = await listTrips(email);

  return (
    <div className="tao-ground min-h-screen overflow-x-clip font-tao">
      <div className={container}>
        <nav
          aria-label="Main"
          className="flex items-center justify-between gap-4 py-5 sm:py-6"
        >
          <Link
            href="/"
            className={cn("flex items-baseline gap-2 rounded-md no-underline", focusRing)}
          >
            <span className="text-[17px] font-semibold tracking-tight text-ink">
              Travel Tao
            </span>
            <span aria-hidden="true" className="text-[15px] text-tao-soft">
              道
            </span>
          </Link>
        </nav>
      </div>

      <main>
        <div className={container}>
          <header className="pb-12 pt-8 sm:pb-14 sm:pt-14">
            <p className={eyebrow}>Day Planner</p>
            <h1 className="m-0 mt-4 text-[clamp(2.25rem,4.4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
              <span className="block">Name the trip.</span>
              <span className="block">Set the dates.</span>
            </h1>
            <p className="m-0 mt-5 max-w-[48ch] text-[18px] leading-relaxed text-ink-muted">
              Travel Tao lays out a column for every day between them, waiting
              to be filled.
            </p>
          </header>
        </div>

        <section
          aria-label="New trip"
          className="border-y border-sky/30 bg-sky/10 py-10 sm:py-14"
        >
          <div className={container}>
            <NewTripForm />
          </div>
        </section>

        <div className={container}>
          <TripList trips={trips} />
        </div>
      </main>

      <div className={container}>
        <LandingFooter />
      </div>
    </div>
  );
}
