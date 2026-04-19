import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

type ToolCallResult = z.infer<typeof CallToolResultSchema>;
type ContentBlock = ToolCallResult["content"][number];

function contentBlockToText(block: ContentBlock): string {
  if (block.type === "text") return block.text;
  return JSON.stringify(block);
}

/**
 * Spawns @notionhq/notion-mcp-server as a local subprocess over stdio.
 * This accepts internal integration tokens (ntn_...) via OPENAPI_MCP_HEADERS,
 * unlike mcp.notion.com/mcp which requires OAuth.
 */
export async function createNotionMcpClient(token: string) {
  const serverBin = path.resolve("node_modules/.bin/notion-mcp-server");

  const transport = new StdioClientTransport({
    command: serverBin,
    env: {
      ...(process.env as Record<string, string>),
      OPENAPI_MCP_HEADERS: JSON.stringify({
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      }),
    },
  });

  const client = new Client(
    { name: "dao", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  return { client, close: () => client.close() };
}

/** Lists all Notion MCP tools converted to Anthropic's tool format. */
export async function listAnthropicTools(
  client: Client
): Promise<Anthropic.Tool[]> {
  const { tools } = await client.listTools();

  return tools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: {
      type: "object" as const,
      properties:
        (t.inputSchema.properties as Anthropic.Tool.InputSchema["properties"]) ??
        {},
      required: t.inputSchema.required as string[] | undefined,
    },
  }));
}

/** Executes a single Notion MCP tool call and returns the text result. */
export async function executeTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<{ content: string; isError: boolean }> {
  const raw = await client.callTool(
    { name, arguments: args },
    CallToolResultSchema
  );

  const result = raw as ToolCallResult;
  const content = result.content.map(contentBlockToText).join("\n");
  const isError = (raw as { isError?: boolean }).isError === true;

  return { content, isError };
}
