import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt";
import { TAXONOMY, renderTaxonomy } from "./taxonomy";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt({ notionPageName: "Travel Planner" });

  it("interpolates the Notion parent page name", () => {
    expect(prompt).toContain('Find the parent page named "Travel Planner"');
  });

  it("lists every taxonomy label so the model can only pick valid ones", () => {
    for (const [category, subs] of Object.entries(TAXONOMY)) {
      expect(prompt).toContain(`**${category}**`);
      for (const sub of subs) expect(prompt).toContain(`- ${sub}`);
    }
  });

  it("keeps the phases in order", () => {
    const research = prompt.indexOf("## Phase 1");
    const categorize = prompt.indexOf("## Phase 2");
    const write = prompt.indexOf("## Phase 3");
    expect(research).toBeGreaterThan(-1);
    expect(research).toBeLessThan(categorize);
    expect(categorize).toBeLessThan(write);
  });

  it("accepts an alternate taxonomy", () => {
    const custom = buildSystemPrompt({
      notionPageName: "Trips",
      taxonomy: { Nightlife: ["Bars"] },
    });
    expect(custom).toContain("**Nightlife**");
    expect(custom).not.toContain("**Good Eats**");
  });
});

describe("renderTaxonomy", () => {
  it("emits bolded categories with dashed subcategories", () => {
    expect(renderTaxonomy({ Food: ["Cafes", "Bars"] })).toBe(
      "**Food**\n- Cafes\n- Bars"
    );
  });

  it("separates categories with a blank line", () => {
    expect(renderTaxonomy({ A: ["x"], B: ["y"] })).toBe("**A**\n- x\n\n**B**\n- y");
  });
});
