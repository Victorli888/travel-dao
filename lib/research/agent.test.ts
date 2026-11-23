import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { runAgentLoop, type AgentDeps } from "./agent";

const TOOLS: Anthropic.Tool[] = [
  { name: "search", description: "", input_schema: { type: "object", properties: {} } },
  { name: "create-page", description: "", input_schema: { type: "object", properties: {} } },
];

function text(value: string): Anthropic.Message {
  return {
    content: [{ type: "text", text: value, citations: null }],
    stop_reason: "end_turn",
  } as Anthropic.Message;
}

function toolUse(name: string, id = "tool_1"): Anthropic.Message {
  return {
    content: [{ type: "tool_use", id, name, input: { q: "x" } }],
    stop_reason: "tool_use",
  } as Anthropic.Message;
}

/**
 * Builds deps whose model returns the given turns in order. The loop mutates
 * one messages array in place, so each turn's view of it is snapshotted.
 */
function deps(turns: Anthropic.Message[], overrides: Partial<AgentDeps> = {}) {
  let turn = 0;
  const sent: Anthropic.MessageParam[][] = [];
  const seenSystem: Anthropic.TextBlockParam[][] = [];
  const seenTools: Anthropic.Tool[][] = [];

  const d = {
    listTools: vi.fn(async () => TOOLS),
    createMessage: vi.fn(
      async (
        system: Anthropic.TextBlockParam[],
        tools: Anthropic.Tool[],
        messages: Anthropic.MessageParam[]
      ) => {
        seenSystem.push(system);
        seenTools.push(tools);
        sent.push([...messages]);
        return turns[Math.min(turn++, turns.length - 1)];
      }
    ),
    callTool: vi.fn(async () => ({ content: "ok", isError: false })),
    ...overrides,
  } satisfies AgentDeps;

  return Object.assign(d, { sent, seenSystem, seenTools, turnCount: () => sent.length });
}

describe("runAgentLoop", () => {
  it("returns the model's text when it ends its turn", async () => {
    const d = deps([text("  Saved to the activity bank.  ")]);
    await expect(runAgentLoop("sys", "Tokyo Tower", d)).resolves.toBe(
      "Saved to the activity bank."
    );
    expect(d.turnCount()).toBe(1);
    expect(d.callTool).not.toHaveBeenCalled();
  });

  it("executes tools and feeds the results back before finishing", async () => {
    const d = deps([toolUse("search"), text("Done.")]);
    await expect(runAgentLoop("sys", "Tokyo Tower", d)).resolves.toBe("Done.");
    expect(d.callTool).toHaveBeenCalledWith("search", { q: "x" });
    expect(d.turnCount()).toBe(2);

    const messages = d.sent[1];
    expect(messages).toHaveLength(3);
    expect(messages[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "tool_1", content: "ok", is_error: false },
      ],
    });
  });

  it("reports a thrown tool as an error result instead of crashing the run", async () => {
    const d = deps([toolUse("create-page"), text("Recovered.")], {
      callTool: vi.fn(async () => {
        throw new Error("Submit rejected");
      }),
    });

    await expect(runAgentLoop("sys", "x", d)).resolves.toBe("Recovered.");

    const messages = d.sent[1];
    expect(messages[2]).toEqual({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool_1",
          content: "Submit rejected",
          is_error: true,
        },
      ],
    });
  });

  it("passes a tool's own error flag through", async () => {
    const d = deps([toolUse("search"), text("ok")], {
      callTool: vi.fn(async () => ({ content: "404", isError: true })),
    });
    await runAgentLoop("sys", "x", d);
    const messages = d.sent[1];
    expect((messages[2].content as Array<{ is_error: boolean }>)[0].is_error).toBe(
      true
    );
  });

  it("terminates when the model never stops asking for tools", async () => {
    const d = deps([toolUse("search")]);
    await expect(runAgentLoop("sys", "x", d)).resolves.toBe("");
    expect(d.turnCount()).toBe(15);
  });

  it("caches the system prompt and the tail of the tool list", async () => {
    const d = deps([text("done")]);
    await runAgentLoop("sys", "x", d);

    const [system] = d.seenSystem;
    const [tools] = d.seenTools;
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(tools[0].cache_control).toBeUndefined();
    expect(tools[tools.length - 1].cache_control).toEqual({ type: "ephemeral" });
  });

  it("takes whatever text exists when the model hits the token ceiling", async () => {
    const truncated = {
      content: [{ type: "text", text: "Partial answer", citations: null }],
      stop_reason: "max_tokens",
    } as Anthropic.Message;

    await expect(runAgentLoop("sys", "x", deps([truncated]))).resolves.toBe(
      "Partial answer"
    );
  });
});
