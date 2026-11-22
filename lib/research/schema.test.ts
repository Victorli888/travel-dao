import { describe, expect, it } from "vitest";
import { parseResearchRequest } from "./schema";
import { ValidationError } from "@/lib/api/errors";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";

function post(body: string) {
  return new Request("http://localhost/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("parseResearchRequest", () => {
  it("accepts and trims a normal place query with a trip id", async () => {
    const parsed = await parseResearchRequest(
      post(
        JSON.stringify({
          message: "  Tokyo Tower, Minato City  ",
          tripId: TRIP_ID,
        }),
      ),
    );
    expect(parsed).toEqual({
      message: "Tokyo Tower, Minato City",
      tripId: TRIP_ID,
    });
  });

  it("rejects a body that is not JSON", async () => {
    await expect(parseResearchRequest(post("not json"))).rejects.toThrow(
      ValidationError,
    );
  });

  it("rejects a missing message", async () => {
    await expect(
      parseResearchRequest(post(JSON.stringify({ tripId: TRIP_ID }))),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a missing trip id", async () => {
    await expect(
      parseResearchRequest(
        post(JSON.stringify({ message: "Tokyo Tower, Minato City" })),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a non-uuid trip id", async () => {
    await expect(
      parseResearchRequest(
        post(
          JSON.stringify({
            message: "Tokyo Tower, Minato City",
            tripId: "not-a-uuid",
          }),
        ),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a non-string message", async () => {
    await expect(
      parseResearchRequest(
        post(JSON.stringify({ message: 42, tripId: TRIP_ID })),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a message that is too short", async () => {
    await expect(
      parseResearchRequest(
        post(JSON.stringify({ message: "hi", tripId: TRIP_ID })),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a message that is too long", async () => {
    await expect(
      parseResearchRequest(
        post(
          JSON.stringify({ message: "a".repeat(501), tripId: TRIP_ID }),
        ),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("reports a 400 on the thrown error", async () => {
    const error = await parseResearchRequest(post("{}")).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.status).toBe(400);
  });
});
