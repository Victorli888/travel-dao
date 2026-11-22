import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt();

  it("points the model at the activity bank, not Notion", () => {
    expect(prompt).toContain("activity bank is the source of truth");
    expect(prompt).not.toContain("Notion");
  });

  it("requires the submit_activity tool", () => {
    expect(prompt).toContain("submit_activity");
  });

  it("keeps the phases in order", () => {
    const research = prompt.indexOf("## Phase 1");
    const submit = prompt.indexOf("## Phase 2");
    const reply = prompt.indexOf("## Phase 3");
    expect(research).toBeGreaterThan(-1);
    expect(research).toBeLessThan(submit);
    expect(submit).toBeLessThan(reply);
  });
});
