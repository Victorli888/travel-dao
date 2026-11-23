import Link from "next/link";
import { notFound } from "next/navigation";
import ActivityBank from "@/components/planner/ActivityBank";
import DayPlanner from "@/components/planner/DayPlanner";
import RouteMotif from "@/components/planner/RouteMotif";
import { buttonStyles } from "@/components/ui/Button";
import { focusRing } from "@/components/landing/styles";
import { requireUserEmail } from "@/lib/auth/session";
import { generateDays, getItinerary } from "@/lib/itinerary";
// Deep imports, not the barrel: `@/lib/itinerary` carries `server-only`, and
// `bank.ts` has to stay reachable from the client component below it.
import { bankCounts, toBankEntries } from "@/lib/itinerary/bank";
import { summarizePlan, toPlanDays } from "@/lib/itinerary/day-plan";
import { formatDateRange } from "@/lib/itinerary/format";

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
  const summary = summarizePlan(planDays);

  // Every figure is a count of recorded data; nothing here is estimated.
  const stats = [
    { label: summary.days === 1 ? "Day" : "Days", value: summary.days },
    { label: summary.stops === 1 ? "Stop" : "Stops", value: summary.stops },
    { label: summary.areas === 1 ? "Area" : "Areas", value: summary.areas },
    { label: "Saved", value: counts.saved },
  ];
  const addHref = `/plan/${trip.id}/add`;

  return (
    <main className="tao-ground min-h-screen font-tao">
      {/* The navy band. White and sky on ink both clear AA by a wide margin;
          ember appears only as the date dot and the motif's plane. */}
      <header className="relative overflow-hidden bg-ink text-paper">
        <RouteMotif
          tone="dark"
          className="absolute right-[max(0px,calc(50vw-40rem))] top-10 hidden w-[30rem] opacity-90 lg:block xl:w-[34rem]"
        />
        <div className={WIDE}>
          <nav className="relative flex items-baseline justify-between gap-6 py-6">
            <Link href="/" className={`flex items-baseline gap-2 no-underline ${focusRing}`}>
              <span className="text-[17px] font-semibold tracking-tight text-paper">
                Travel Tao
              </span>
              <span className="text-[15px] text-sky">道</span>
            </Link>
            <Link
              href="/plan"
              className={`text-[13px] font-medium text-sky underline-offset-4 transition-colors hover:text-paper hover:underline ${focusRing}`}
            >
              All trips
            </Link>
          </nav>

          <div className="relative pb-10 pt-4 sm:pb-12 sm:pt-8">
            <p className="m-0 inline-flex items-center gap-2 rounded-full bg-paper/10 px-3 py-1 text-[13px] font-medium text-sky">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ember" />
              {formatDateRange(trip.startDate, trip.endDate)}
            </p>
            <h1 className="m-0 mt-5 max-w-[18ch] font-display text-[clamp(2.75rem,6.5vw,4.75rem)] font-semibold leading-[1] tracking-[-0.02em] text-paper">
              {trip.name}
            </h1>

            <dl className="m-0 mt-8 grid max-w-[40rem] grid-cols-4 divide-x divide-paper/15 border-t border-paper/15 pt-6">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col-reverse gap-1 px-3 first:pl-0 sm:px-6">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky">
                    {stat.label}
                  </dt>
                  <dd className="m-0 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-none text-paper">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </header>

      <section aria-labelledby="days-heading" className="bg-sky/10 pb-16 pt-8 sm:pb-20 sm:pt-10">
        <div className={WIDE}>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-6">
            <div>
              <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.14em] text-tao">
                Day by day
              </p>
              <h2
                id="days-heading"
                className="m-0 mt-1 font-display text-[clamp(1.75rem,3.2vw,2.25rem)] font-semibold tracking-[-0.01em] text-ink"
              >
                Your itinerary
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* The page's one ember action. */}
              <Link href={addHref} className={buttonStyles({ variant: "ember", size: "sm" })}>
                Add activity
              </Link>
              <ActivityBank entries={entries} counts={counts} addHref={addHref} />
            </div>
          </div>

          <DayPlanner days={planDays} />

          <p className="m-0 mt-10 max-w-[60ch] text-[15px] leading-relaxed text-ink-muted">
            Plan It lands here next. For now,{" "}
            <Link
              href={addHref}
              className="font-medium text-tao underline underline-offset-4 transition-colors hover:text-tao-bright"
            >
              research a place
            </Link>{" "}
            and save it to the activity bank.
          </p>
        </div>
      </section>
    </main>
  );
}

/** Wider than the landing's 72rem: the day grid earns the room at 1440. */
const WIDE = "mx-auto w-full max-w-[80rem] px-5 sm:px-8";
