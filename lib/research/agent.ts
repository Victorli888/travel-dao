import Anthropic from "@anthropic-ai/sdk";
import { ConfigError, ValidationError } from "@/lib/api/errors";
import type { ActivityDraft } from "@/lib/itinerary/schemas";
import { buildSystemPrompt } from "./prompt";
import {
  parseSubmitActivity,
  SUBMIT_ACTIVITY_TOOL,
  SUBMIT_ACTIVITY_TOOL_NAME,
} from "./submit-tool";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;
/** Safety valve: the model gets this many turns to finish its submit. */
const MAX_ITERATIONS = 15;

/**
 * Everything the loop needs from the outside world. Injected so the control
 * flow can be tested without a network.
 */
export interface AgentDeps {
  listTools: () => Promise<Anthropic.Tool[]>;
  createMessage: (
    system: Anthropic.TextBlockParam[],
    tools: Anthropic.Tool[],
    messages: Anthropic.MessageParam[],
  ) => Promise<Anthropic.Message>;
  callTool: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ content: string; isError: boolean }>;
}

/** What the route persists after a successful research run. */
export interface ResearchResult {
  draft: ActivityDraft;
  /** Claude's short confirmation reply. */
  message: string;
}

/** Concatenates the text blocks of an assistant turn. */
function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Marks the final tool for prompt caching. The tool list is static, so
 * caching it across turns is most of the cost saving.
 */
function withCacheBreakpoint(tools: Anthropic.Tool[]): Anthropic.Tool[] {
  return tools.map((tool, i) =>
    i === tools.length - 1
      ? { ...tool, cache_control: { type: "ephemeral" as const } }
      : tool,
  );
}

/**
 * Runs every tool call in an assistant turn. A thrown tool becomes an error
 * result rather than aborting the run, so the model can recover.
 */
async function runToolBatch(
  blocks: Anthropic.ToolUseBlock[],
  callTool: AgentDeps["callTool"],
): Promise<Anthropic.ToolResultBlockParam[]> {
  return Promise.all(
    blocks.map(async (block) => {
      try {
        const { content, isError } = await callTool(
          block.name,
          block.input as Record<string, unknown>,
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
    }),
  );
}

/**
 * The agentic loop: prompt the model, run whatever tools it asks for, repeat
 * until it stops. Returns the model's final text.
 */
export async function runAgentLoop(
  systemPrompt: string,
  userMessage: string,
  deps: AgentDeps,
): Promise<string> {
  const tools = withCacheBreakpoint(await deps.listTools());
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
  ];
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await deps.createMessage(system, tools, messages);
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      messages.push({
        role: "user",
        content: await runToolBatch(toolUses, deps.callTool),
      });
      continue;
    }

    // end_turn, max_tokens, stop_sequence — take whatever text we have.
    return extractText(response.content);
  }

  // Ran out of turns. Surface the last thing the model said, if anything.
  const last = messages.findLast((m) => m.role === "assistant");
  return Array.isArray(last?.content)
    ? extractText(last.content as Anthropic.ContentBlock[])
    : "";
}

/**
 * Wires the loop to Anthropic and a host-side `submit_activity` tool that
 * captures a validated activity draft. Persistence is the route's job.
 */
export async function runResearchAgent(
  message: string,
): Promise<ResearchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new ConfigError("Place research is not configured.");
  const anthropic = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt();

  const submitted: { draft: ActivityDraft | null } = { draft: null };

  const reply = await runAgentLoop(systemPrompt, message, {
    listTools: async () => [SUBMIT_ACTIVITY_TOOL],
    createMessage: (system, tools, messages) =>
      anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools,
        messages,
      }),
    callTool: async (name, args) => {
      if (name !== SUBMIT_ACTIVITY_TOOL_NAME) {
        return { content: `Unknown tool: ${name}`, isError: true };
      }
      const result = parseSubmitActivity(args, message);
      if (!result.ok) {
        return { content: result.error, isError: true };
      }
      submitted.draft = result.draft;
      return {
        content:
          "Activity accepted. Reply briefly confirming it was saved to the activity bank.",
        isError: false,
      };
    },
  });

  const draft = submitted.draft;
  if (!draft) {
    throw new ValidationError(
      "Could not identify a place to save. Try again with a clearer name and address.",
    );
  }

  return {
    draft,
    message: reply || `Saved ${draft.name} to the activity bank.`,
  };
}
