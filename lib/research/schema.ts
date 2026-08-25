import { z } from "zod";
import { ValidationError } from "@/lib/api/errors";

/** Body of POST /api/research. There was previously no bound at all. */
export const ResearchRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(3, "Describe a place — at least a name and address.")
    .max(500, "That's too long. Keep it to a place name and address."),
});

export type ResearchRequest = z.infer<typeof ResearchRequestSchema>;

/** Reads and validates a request body, converting any failure into a 400. */
export async function parseResearchRequest(
  request: Request
): Promise<ResearchRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const parsed = ResearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid request body"
    );
  }
  return parsed.data;
}
