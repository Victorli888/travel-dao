import { beforeEach, describe, expect, it, vi } from "vitest";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("@/lib/auth/session", () => ({
  requireUserEmail: vi.fn(async () => "tester@example.com"),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/research/agent", () => ({
  runResearchAgent: vi.fn(async () => ({
    draft: {
      name: "Tokyo Tower",
      summary: "A landmark observation deck in Minato.",
      address: "4 Chome-2-8 Shibakoen, Minato City, Tokyo",
      area: "Shibakoen",
      source: "ai_generated",
    },
    message: "Saved Tokyo Tower to the activity bank.",
  })),
}));

vi.mock("@/lib/itinerary", () => ({
  addActivity: vi.fn(async () => ({
    id: "22222222-2222-4222-8222-222222222222",
    name: "Tokyo Tower",
    summary: "A landmark observation deck in Minato.",
    area: "Shibakoen",
  })),
}));

import { POST } from "./route";
import { requireUserEmail } from "@/lib/auth/session";
import { addActivity } from "@/lib/itinerary";
import { runResearchAgent } from "@/lib/research/agent";

function post(body: string) {
  return new Request("http://localhost/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/research", () => {
  beforeEach(() => vi.clearAllMocks());

  it("researches, inserts, and returns the saved activity", async () => {
    const response = await POST(
      post(
        JSON.stringify({
          message: "Tokyo Tower, Minato City",
          tripId: TRIP_ID,
        }),
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Saved Tokyo Tower to the activity bank.",
      activity: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Tokyo Tower",
        summary: "A landmark observation deck in Minato.",
        area: "Shibakoen",
      },
    });
    expect(requireUserEmail).toHaveBeenCalledOnce();
    expect(runResearchAgent).toHaveBeenCalledWith("Tokyo Tower, Minato City");
    expect(addActivity).toHaveBeenCalledWith(
      "tester@example.com",
      TRIP_ID,
      expect.objectContaining({ name: "Tokyo Tower" }),
    );
  });

  it("rejects an invalid body with 400, not 500", async () => {
    const response = await POST(post("{}"));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBeTruthy();
    expect(runResearchAgent).not.toHaveBeenCalled();
    expect(addActivity).not.toHaveBeenCalled();
  });

  it("maps an agent failure to the error envelope", async () => {
    vi.mocked(runResearchAgent).mockRejectedValueOnce(new Error("boom"));
    const response = await POST(
      post(
        JSON.stringify({
          message: "Tokyo Tower, Minato City",
          tripId: TRIP_ID,
        }),
      ),
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "boom",
    });
  });
});
