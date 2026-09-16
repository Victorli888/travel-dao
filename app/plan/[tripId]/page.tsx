import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserEmail } from "@/lib/auth/session";
import { generateDays, getTrip, listDays } from "@/lib/itinerary";
import { formatDateRange, formatDayLabel } from "@/lib/itinerary/format";

interface Props {
  params: Promise<{ tripId: string }>;
}

/**
 * The trip itself — today a column per day and nothing in them. Frames 1-3
 * (the Activity Bank, dropping a place onto a day, Plan It) land here.
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

  const trip = await getTrip(email, tripId);
  // Missing and not-yours are the same answer — telling them apart would leak
  // which trip ids exist.
  if (!trip) notFound();

  let days = await listDays(email, trip.id);
  if (days.length === 0 && trip.startDate && trip.endDate) {
    days = await generateDays(email, trip.id);
  }

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

        <header className="pb-8 pt-6 sm:pt-8">
          <h1 className="m-0 text-[clamp(1.75rem,4vw,2.5rem)] font-medium leading-tight tracking-[-0.025em] text-ink">
            {trip.name}
          </h1>
          <p className="mt-3 text-[15px] text-ink-muted">
            {formatDateRange(trip.startDate, trip.endDate)} ·{" "}
            {days.length} {days.length === 1 ? "day" : "days"}
          </p>
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
                <span className="mt-auto text-[13px] leading-relaxed text-ink-subtle">
                  Nothing planned yet.
                </span>
              </li>
            ))}
          </ol>
        </section>

        <p className="m-0 max-w-[54ch] pb-16 text-[15px] leading-relaxed text-ink-muted">
          The Activity Bank and Plan It land here next. For now you can research
          a place and{" "}
          <Link
            href="/write-to-notion"
            className="font-medium text-tao underline-offset-4 transition-colors hover:text-ember"
          >
            file it in Notion
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
