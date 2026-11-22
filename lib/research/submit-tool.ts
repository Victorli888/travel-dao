import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  ActivityDraftSchema,
  type ActivityDraft,
} from "@/lib/itinerary/schemas";

export const SUBMIT_ACTIVITY_TOOL_NAME = "submit_activity";

/**
 * Tool input is the activity draft plus optional category labels the DB does
 * not store as columns — those land in `sourceMetadata`.
 */
const SubmitActivityInputSchema = ActivityDraftSchema.omit({
  source: true,
  sourceMetadata: true,
  lat: true,
  lng: true,
  durationMinutes: true,
  priorityScore: true,
}).extend({
  category: z.string().trim().min(1).max(100).optional(),
  subcategory: z.string().trim().min(1).max(100).optional(),
});

export type SubmitActivityInput = z.infer<typeof SubmitActivityInputSchema>;

/** The single host tool the research agent is allowed to call. */
export const SUBMIT_ACTIVITY_TOOL: Anthropic.Tool = {
  name: SUBMIT_ACTIVITY_TOOL_NAME,
  description:
    "Submit the researched place so the host can save it to the trip's activity bank. Call once with verified fields after research is complete.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Canonical place name.",
      },
      summary: {
        type: "string",
        description: "2–4 sentence overview of the place.",
      },
      address: {
        type: ["string", "null"],
        description: "Full formatted address, or null if unknown.",
      },
      area: {
        type: ["string", "null"],
        description: "Neighbourhood / ward label only, or null if unknown.",
      },
      hoursOperation: {
        type: ["string", "null"],
        description: "Compressed hours string, or null if unverified.",
      },
      category: {
        type: "string",
        description: 'Short free-text category, e.g. "Restaurant".',
      },
      subcategory: {
        type: "string",
        description: 'Optional finer label, e.g. "Ramen".',
      },
    },
    required: ["name", "summary"],
  },
};

/**
 * Validates tool args and maps them into an `ActivityDraft` ready for
 * `addActivity`. Category labels go into `sourceMetadata`.
 */
export function parseSubmitActivity(
  args: Record<string, unknown>,
  query: string,
):
  | { ok: true; draft: ActivityDraft }
  | { ok: false; error: string } {
  const parsed = SubmitActivityInputSchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Invalid activity fields. Fix name/summary/address/area/hours and retry.",
    };
  }

  const { category, subcategory, ...fields } = parsed.data;
  const draft: ActivityDraft = {
    ...fields,
    source: "ai_generated",
    sourceMetadata: {
      query,
      ...(category ? { category } : {}),
      ...(subcategory ? { subcategory } : {}),
    },
  };

  return { ok: true, draft };
}
