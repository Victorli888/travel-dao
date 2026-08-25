import Anthropic from "@anthropic-ai/sdk";
import {
  createNotionMcpClient,
  listAnthropicTools,
  executeTool,
} from "@/lib/mcp/notion-client";
import { buildSystemPrompt } from "./prompt";
import { getEnv } from "@/lib/api/env";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;
/** Safety valve: the model gets this many turns to finish its Notion writes. */
const MAX_ITERATIONS = 15;

/**
 * Everything the loop needs from the outside world. Injected so the control
 * flow can be tested without a network or a subprocess.
 */
export interface AgentDeps {
  listTools: () => Promise<Anthropic.Tool[]>;
  createMessage: (
    system: Anthropic.TextBlockParam[],
    tools: Anthropic.Tool[],
    messages: Anthropic.MessageParam[]
  ) => Promise<Anthropic.Message>;
  callTool: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<{ content: string; isError: boolean }>;
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
 * Marks the final tool for prompt caching. The tool list is long and static,
 * so caching it across turns is most of the cost saving.
 */
function withCacheBreakpoint(tools: Anthropic.Tool[]): Anthropic.Tool[] {
  return tools.map((tool, i) =>
    i === tools.length - 1
      ? { ...tool, cache_control: { type: "ephemeral" as const } }
      : tool
  );
}

/**
 * Runs every tool call in an assistant turn. A thrown tool becomes an error
 * result rather than aborting the run, so the model can recover.
 */
async function runToolBatch(
  blocks: Anthropic.ToolUseBlock[],
  callTool: AgentDeps["callTool"]
): Promise<Anthropic.ToolResultBlockParam[]> {
  return Promise.all(
    blocks.map(async (block) => {
      try {
        const { content, isError } = await callTool(
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
}

/**
 * The agentic loop: prompt the model, run whatever tools it asks for, repeat
 * until it stops. Returns the model's final text.
 */
export async function runAgentLoop(
  systemPrompt: string,
  userMessage: string,
  deps: AgentDeps
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
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
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
 * Wires the loop to the real Anthropic client and a live Notion MCP
 * subprocess, and guarantees the subprocess is torn down.
 */
export async function runResearchAgent(message: string): Promise<string> {
  const env = getEnv();
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const systemPrompt = buildSystemPrompt({
    notionPageName: env.NOTION_PAGE_NAME,
  });

  const { client, close } = await createNotionMcpClient(env.NOTION_API_KEY);

  try {
    return await runAgentLoop(systemPrompt, message, {
      listTools: () => listAnthropicTools(client),
      createMessage: (system, tools, messages) =>
        anthropic.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          tools,
          messages,
        }),
      callTool: (name, args) => executeTool(client, name, args),
    });
  } finally {
    await close();
  }
}
