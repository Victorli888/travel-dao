import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createNotionMcpClient, listAnthropicTools, executeTool } from "@/lib/mcp-client";

export const maxDuration = 120;

const anthropic = new Anthropic();

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }
  if (!process.env.NOTION_API_KEY) {
    return NextResponse.json(
      { success: false, error: "NOTION_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const { message } = await request.json();
    const notionPageName = process.env.NOTION_PAGE_NAME || "Travel Planner";

    const systemPrompt = `You are a meticulous travel-and-places researcher and Notion organizer. The user sends free-form text (often a business name plus address or area). Your job runs in strict order: research → categorize → write to Notion. The host app does not need structured data or a full write-up in the chat; **Notion is the source of truth** for the researched details.

## Phase 1 — Research (must complete before Notion)
From the user message, resolve the exact place (disambiguate if multiple matches). Gather and verify:

1. **Location**
   - Canonical name of the place
   - Full address as given or as confirmed (include postal code and building/floor if known)
   - Neighborhood / ward / city / country in a single readable line
2. **Summary of the location**
   - 2–4 sentences: what it is, what it's known for, vibe, and why someone would visit
   - Avoid marketing fluff; be concrete (specialties, style, notable awards or history only if verifiable)
3. **Hours of operation**
   - Current regular hours by day (or "same daily" if applicable)
   - Note holidays, irregular closures, or "hours not published" if you cannot verify — never invent times

If critical facts are uncertain, say what is unknown and give your best cautious inference labeled as such.

## Phase 2 — Categorize for Notion
Classify the place into **one top-level category** and **one subcategory** from this taxonomy (use these exact labels for toggles):

**Good Eats**
- Cafes
- Restaurants
- Dessert
- Other

**Shopping & Markets**
- Souvenirs
- Fashion
- Sports
- 2nd Hand
- Beauty
- Tech
- Food & Consumables
- Luxury
- Market and Bazaars

**Activities**
- Cultural & Historical Experiences
- Outdoor & Nature
- Sightseeing & Landmarks
- Relaxation & Wellness
- Entertainment & Night Life

If ambiguous, choose the best-fit subcategory and note the ambiguity briefly under **Practical notes** in the Notion entry.

## Phase 3 — Write with Notion MCP (city → toggles → entry)

Use the Notion MCP tools to organize under the workspace parent:

1. Find the parent page named "${notionPageName}" (exact name).
2. Determine the **city** from your research (short clear name, e.g. \`Kyoto\`, \`Tokyo\`).
3. Under that parent, search for a **child page whose title is exactly the city name**.
4. If no city page exists, **create** a child page titled with that city name under "${notionPageName}".
5. On the **city page**, ensure these **top-level toggles** exist (create if missing):
   - Good Eats
   - Shopping & Markets
   - Activities
6. Inside the toggle that matches Phase 2's top-level category, ensure a **nested toggle** exists for the chosen **subcategory** (create if missing).
7. Under that **subcategory toggle**, add the new place entry.

### Entry content (inside the subcategory toggle)
Create a **toggle block** titled: **[Place name]** (optionally suffix " — [short area]" if it helps disambiguate). Always use a toggle block — never a heading or plain paragraph.

Inside the entry include:
- **Overview** — summary from Phase 1
- **Location & address** — formatted address
- **Hours** — structured bullets; unknown sections = "Unknown / not verified"

Use Notion-friendly blocks (paragraphs, bullets, bold labels). If data is missing, write "Unknown / not verified" instead of guessing.

If the Notion API cannot create nested toggles in one step, flatten temporarily: put the entry under the correct top-level toggle with a bold subheading line **Subcategory: [name]** above the entry.

## Phase 4 — Reply to the user (minimal)
After the Notion entry is successfully written, reply with **at most 2–3 sentences**: confirm success, give the **Notion path** (e.g. \`Kyoto > Good Eats > Dessert > Patisserie Rau\`), and note anything critical (e.g. hours unverified). Do **not** output JSON, code fences, or a full repeat of the research.`;

    // Open MCP connection — closed in finally block regardless of outcome
    const { client, close } = await createNotionMcpClient(
      process.env.NOTION_API_KEY
    );

    try {
      const tools = await listAnthropicTools(client);
      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: message },
      ];

      let finalText = "";
      const MAX_ITERATIONS = 15;

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
          tools: tools.map((tool, i) =>
            i === tools.length - 1
              ? { ...tool, cache_control: { type: "ephemeral" } }
              : tool
          ),
          messages,
        });

        // Append assistant turn to history
        messages.push({ role: "assistant", content: response.content });

        if (response.stop_reason === "end_turn") {
          finalText = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("")
            .trim();
          break;
        }

        if (response.stop_reason === "tool_use") {
          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          // Execute all tool calls in parallel
          const toolResults = await Promise.all(
            toolUseBlocks.map(async (block) => {
              try {
                const { content, isError } = await executeTool(
                  client,
                  block.name,
                  block.input as Record<string, unknown>
                );
                return {
                  type: "tool_result" as const,
                  tool_use_id: block.id,
                  content,
                  is_error: isError,
                };
              } catch (err) {
                return {
                  type: "tool_result" as const,
                  tool_use_id: block.id,
                  content: err instanceof Error ? err.message : "Tool call failed",
                  is_error: true,
                };
              }
            })
          );

          messages.push({ role: "user", content: toolResults });
          continue;
        }

        // stop_reason: "max_tokens" or "stop_sequence" — extract whatever text exists
        finalText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        break;
      }

      return NextResponse.json({ success: true, message: finalText });
    } finally {
      await close();
    }
  } catch (error) {
    console.error("Research error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    // Surface MCP auth errors clearly
    if (message.includes("Authentication error")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Notion authentication failed. Check that your NOTION_API_KEY is valid and the integration is connected to your planner page.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
