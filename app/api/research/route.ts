import { requireUserEmail } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/api/errors";
import { addActivity, getTrip } from "@/lib/itinerary";
import { runResearchAgent } from "@/lib/research/agent";
import { parseResearchRequest } from "@/lib/research/schema";
import { ok, fail } from "@/lib/api/responses";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { message, tripId } = await parseResearchRequest(request);
    const email = await requireUserEmail();
    const trip = await getTrip(email, tripId);
    if (!trip) throw new NotFoundError("That trip does not exist.");

    const { draft, message: reply } = await runResearchAgent(message);
    const activity = await addActivity(email, tripId, draft);

    return ok(reply, {
      id: activity.id,
      name: activity.name,
      summary: activity.summary,
      area: activity.area,
    });
  } catch (error) {
    return fail(error);
  }
}
