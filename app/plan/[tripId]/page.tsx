import Link from "next/link";
import { notFound } from "next/navigation";
import ActivityBank from "@/components/planner/ActivityBank";
import DayPlanner from "@/components/planner/DayPlanner";
import { container } from "@/components/landing/styles";
import { requireUserEmail } from "@/lib/auth/session";
import { generateDays, getItinerary } from "@/lib/itinerary";
// Deep imports, not the barrel: `@/lib/itinerary` carries `server-only`, and
// `bank.ts` has to stay reachable from the client component below it.
import { bankCounts, toBankEntries } from "@/lib/itinerary/bank";
import { toPlanDays } from "@/lib/itinerary/day-plan";
import { formatDateRange, formatDayCount } from "@/lib/itinerary/format";

interface Props {
  params: Promise<{ tripId: string }>;
}

/**
 * The trip itself — a card per day that opens the day's plan in a dialog, and
 * the Activity Bank over it. Placing
 * a saved activity onto a day, and Plan It, land here next.
 *
 * **Day generation happens on first view, not in the create action.** The
 * Neon HTTP driver has no interactive transactions, so `createTripAction`
 * keeps to a single write; this is the second, in its own request. It is one
 * `INSERT ... ON CONFLICT DO NOTHING`, so the page is idempotent and a reload
 * retries it if it ever fails. Do not move it back into the action.
 */
export default async function TripPage({ params }: Props) {
  const { tripId } = await params;
  const email = await requireUserEmail();

  const itinerary = await getItinerary(email, tripId);
  // Missing and not-yours are the same answer — telling them apart would leak
  // which trip ids exist.
  if (!itinerary) notFound();

  const { trip, activities, unscheduled } = itinerary;

  let days = itinerary.days;
  if (days.length === 0 && trip.startDate && trip.endDate) {
    // No days means no placements could exist, so every generated day is
    // empty and the activity lists above are already right. Re-reading the
    // itinerary here would buy nothing.
    days = (await generateDays(email, trip.id)).map((day) => ({
      ...day,
      activities: [],
    }));
  }

  // Shaped here, on the server: `ActivityBank` receives plain strings, so
  // nothing in `components/planner/` has to transform domain data.
  const entries = toBankEntries(activities);
  const counts = bankCounts(activities, unscheduled);
  const planDays = toPlanDays(days);

  return (
    <main className="tao-ground min-h-screen font-tao">
      <div className={container}>
        <nav className="flex items-baseline justify-between gap-6 py-6">
          <Link href="/" className="flex items-baseline gap-2 no-underline">
            <span className="text-[17px] font-semibold tracking-tight text-ink">
              Travel Tao
            </span>
            <span className="text-[15px] text-tao-soft">道</span>
          </Link>
          <Link
            href="/plan"
            className="text-[13px] font-medium text-ink-subtle underline-offset-4 transition-colors hover:text-tao"
          >
            All trips
          </Link>
        </nav>

        <header className="flex flex-wrap items-end justify-between gap-6 pb-12 pt-6 sm:pt-10">
          <div className="min-w-0">
            <p className="m-0 inline-flex items-center gap-2 rounded-full bg-sky/15 px-3 py-1 text-[13px] font-medium text-tao">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ember" />
              {formatDateRange(trip.startDate, trip.endDate)}
            </p>
            <h1 className="m-0 mt-5 text-[clamp(2rem,4.4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
              {trip.name}
            </h1>
            <p className="m-0 mt-4 text-[17px] text-ink-muted">
              {formatDayCount(days.length)} · {counts.placed} of {counts.saved}{" "}
              saved {counts.saved === 1 ? "activity" : "activities"} planned
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/plan/${trip.id}/add`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-tao px-4 py-2 text-xs font-medium text-tao transition-colors hover:bg-tao-wash"
            >
              Add activity
            </Link>
            <ActivityBank
              entries={entries}
              counts={counts}
              addHref={`/plan/${trip.id}/add`}
            />
          </div>
        </header>
      </div>

      <section
        aria-label="Days"
        className="border-y border-sky/30 bg-sky/10 py-12 sm:py-16"
      >
        <div className={container}>
          <DayPlanner days={planDays} />
        </div>
      </section>

      <div className={container}>
        <p className="m-0 max-w-[54ch] py-12 text-[15px] leading-relaxed text-ink-muted">
          Plan It lands here next. For now,{" "}
          <Link
            href={`/plan/${trip.id}/add`}
            className="font-medium text-tao underline-offset-4 transition-colors hover:text-ember"
          >
            research a place
          </Link>{" "}
          and save it to the activity bank.
        </p>
      </div>
    </main>
  );
}
