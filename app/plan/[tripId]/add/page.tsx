import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import ResearchPanel from "@/components/ResearchPanel";
import { requireUserEmail } from "@/lib/auth/session";
import { getTrip } from "@/lib/itinerary";

interface Props {
  params: Promise<{ tripId: string }>
}

/**
 * Trip-scoped research: find the right place and save it to this trip's
 * activity bank. The panel owns the request lifecycle; this page only loads
 * the trip so the copy can name it.
 */
export default async function AddActivityPage({ params }: Props) {
  const { tripId } = await params;
  const email = await requireUserEmail();
  const trip = await getTrip(email, tripId);
  if (!trip) notFound();

  return (
    <PageShell>
      <Link
        href={`/plan/${trip.id}`}
        className="mb-8 inline-block text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        &larr; {trip.name}
      </Link>
      <ResearchPanel tripId={trip.id} tripName={trip.name} />
    </PageShell>
  );
}
