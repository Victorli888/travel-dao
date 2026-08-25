import { describe, expect, it } from "vitest";
import { parseNotionPath } from "./parse-reply";

describe("parseNotionPath", () => {
  it("prefers the backticked path the system prompt asks for", () => {
    const { path, body } = parseNotionPath(
      "Saved. `Kyoto > Good Eats > Dessert > Patisserie Rau` is in your planner. Hours unverified."
    );
    expect(path).toBe("Kyoto > Good Eats > Dessert > Patisserie Rau");
    expect(body).not.toContain(">");
    expect(body).toContain("Hours unverified");
  });

  it("falls back to an unfenced path", () => {
    const { path } = parseNotionPath(
      "Kyoto > Good Eats > Dessert > Patisserie Rau. Hours unverified."
    );
    expect(path).toBe("Kyoto > Good Eats > Dessert > Patisserie Rau");
  });

  it("documents that the unfenced fallback over-captures adjacent prose", () => {
    // Known limitation of the loose scan; the backticked form avoids it.
    const { path } = parseNotionPath(
      "Saved. Kyoto > Good Eats > Dessert > Patisserie Rau is in your planner."
    );
    expect(path).toBe(
      "Kyoto > Good Eats > Dessert > Patisserie Rau is in your planner"
    );
  });

  it("handles CJK place names", () => {
    const { path } = parseNotionPath("Tokyo > Activities > 東京タワー > 展望台");
    expect(path).toContain("東京");
  });

  it("keeps ampersands inside segment names", () => {
    const { path } = parseNotionPath(
      "Done: Tokyo > Shopping & Markets > Tech > Yodobashi Camera"
    );
    expect(path).toBe("Tokyo > Shopping & Markets > Tech > Yodobashi Camera");
  });

  it("returns the message untouched when there is no path", () => {
    const message = "Saved it to Notion. Hours were not published anywhere.";
    expect(parseNotionPath(message)).toEqual({ path: null, body: message });
  });

  it("ignores a chain too short to be a path", () => {
    // Two segments only — the pattern needs at least three.
    expect(parseNotionPath("Kyoto > Good Eats").path).toBeNull();
  });

  it("never returns an empty body, even when the reply is only a path", () => {
    const message = "Kyoto > Good Eats > Dessert > Patisserie Rau";
    const { path, body } = parseNotionPath(message);
    expect(path).toBe(message);
    expect(body).toBe(message);
  });
});
