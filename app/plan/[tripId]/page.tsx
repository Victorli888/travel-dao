import Link from "next/link";
import { notFound } from "next/navigation";
import ActivityBank from "@/components/planner/ActivityBank";
import { requireUserEmail } from "@/lib/auth/session";
import { generateDays, getItinerary } from "@/lib/itinerary";
// Deep imports, not the barrel: `@/lib/itinerary` carries `server-only`, and
// `bank.ts` has to stay reachable from the client component below it.
import { bankCounts, toBankEntries } from "@/lib/itinerary/bank";
import { formatDateRange, formatDayLabel } from "@/lib/itinerary/format";

interface Props {
  params: Promise<{ tripId: string }>;
}

/**
 * The trip itself — a column per day, and the Activity Bank over it. Placing
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
          <Link
            href="/plan"
            className="text-[13px] font-medium text-ink-subtle underline-offset-4 transition-colors hover:text-tao"
          >
            All trips
          </Link>
        </nav>

        <header className="flex flex-wrap items-start justify-between gap-6 pb-8 pt-6 sm:pt-8">
          <div className="min-w-0">
            <h1 className="m-0 text-[clamp(1.75rem,4vw,2.5rem)] font-medium leading-tight tracking-[-0.025em] text-ink">
              {trip.name}
            </h1>
            <p className="mt-3 text-[15px] text-ink-muted">
              {formatDateRange(trip.startDate, trip.endDate)} ·{" "}
              {days.length} {days.length === 1 ? "day" : "days"}
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

        <div className="rule-fade" />

        <section className="overflow-x-auto pb-6 pt-8">
          <ol className="m-0 flex list-none gap-4 p-0">
            {days.map((day) => (
              <li
                key={day.id}
                className="flex min-h-[15rem] w-[13.5rem] shrink-0 flex-col rounded-2xl border border-rule bg-paper-raised p-4"
              >
                <span className="text-[13px] font-medium tracking-tight text-ink">
                  {/* NULL means unnamed, so the date is the fallback identity. */}
                  {day.name ?? formatDayLabel(day.date)}
                </span>
                {day.name && (
                  <span className="mt-0.5 text-[12px] text-ink-subtle">
                    {formatDayLabel(day.date)}
                  </span>
                )}
                {day.activities.length === 0 ? (
                  <span className="mt-auto text-[13px] leading-relaxed text-ink-subtle">
                    Nothing planned yet.
                  </span>
                ) : (
                  <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                    {day.activities.map((activity) => (
                      <li
                        key={activity.id}
                        className="rounded-xl border border-rule bg-paper px-3 py-2 text-[13px] leading-snug text-ink"
                      >
                        {activity.name}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>

        <p className="m-0 max-w-[54ch] pb-16 text-[15px] leading-relaxed text-ink-muted">
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
