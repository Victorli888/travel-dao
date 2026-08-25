import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/research/agent", () => ({
  runResearchAgent: vi.fn(async (message: string) => `Saved ${message}`),
}));

import { POST } from "./route";
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

  it("returns the agent's reply on success", async () => {
    const response = await POST(post(JSON.stringify({ message: "Tokyo Tower" })));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Saved Tokyo Tower",
    });
    expect(runResearchAgent).toHaveBeenCalledWith("Tokyo Tower");
  });

  it("rejects an invalid body with 400, not 500", async () => {
    const response = await POST(post("{}"));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBeTruthy();
    expect(runResearchAgent).not.toHaveBeenCalled();
  });

  it("maps an agent failure to the error envelope", async () => {
    vi.mocked(runResearchAgent).mockRejectedValueOnce(new Error("boom"));
    const response = await POST(post(JSON.stringify({ message: "Tokyo Tower" })));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "boom",
    });
  });
});
