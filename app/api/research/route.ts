import { runResearchAgent } from "@/lib/research/agent";
import { parseResearchRequest } from "@/lib/research/schema";
import { ok, fail } from "@/lib/api/responses";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { message } = await parseResearchRequest(request);
    return ok(await runResearchAgent(message));
  } catch (error) {
    return fail(error);
  }
}
