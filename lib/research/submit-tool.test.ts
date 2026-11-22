import { describe, expect, it } from "vitest";
import { parseSubmitActivity } from "./submit-tool";

describe("parseSubmitActivity", () => {
  it("maps valid fields into an ai_generated draft", () => {
    const result = parseSubmitActivity(
      {
        name: "Patisserie Rau",
        summary: "A quiet Kyoto dessert spot known for fruit tarts.",
        address: "123 Somewhere, Kyoto",
        area: "Pontochō",
        hoursOperation: "Thu–Tue 11:00–18:00",
        category: "Restaurant",
        subcategory: "Dessert",
      },
      "Patisserie Rau, Kyoto",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft).toMatchObject({
      name: "Patisserie Rau",
      summary: "A quiet Kyoto dessert spot known for fruit tarts.",
      address: "123 Somewhere, Kyoto",
      area: "Pontochō",
      hoursOperation: "Thu–Tue 11:00–18:00",
      source: "ai_generated",
      sourceMetadata: {
        query: "Patisserie Rau, Kyoto",
        category: "Restaurant",
        subcategory: "Dessert",
      },
    });
  });

  it("rejects a missing summary", () => {
    const result = parseSubmitActivity(
      { name: "Tokyo Tower" },
      "Tokyo Tower",
    );
    expect(result.ok).toBe(false);
  });
});
