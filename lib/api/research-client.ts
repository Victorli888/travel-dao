import type { ResearchActivity, ResearchResponse } from "@/lib/types";

export interface ResearchSuccess {
  message: string;
  activity: ResearchActivity;
}

/**
 * Calls the research route. Throws on any failure so callers handle exactly
 * one error path instead of checking both `response.ok` and `json.success`.
 */
export async function postResearch(
  message: string,
  tripId: string,
): Promise<ResearchSuccess> {
  const response = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, tripId }),
  });

  const json: ResearchResponse = await response.json();

  if (!response.ok || !json.success || !json.message || !json.activity) {
    throw new Error(json.error || "Something went wrong");
  }

  return { message: json.message, activity: json.activity };
}
