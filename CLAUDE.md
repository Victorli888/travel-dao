# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint
```

## Environment Setup

Copy `.env.example` to `.env.local` and populate all three variables:

- `ANTHROPIC_API_KEY` — Anthropic API key
- `NOTION_API_KEY` — Notion integration token from notion.so/my-integrations; the integration must be shared with your planner page
- `NOTION_PAGE_NAME` — Exact name of the Notion page to save activities under (default: `Travel Planner`)

## Architecture

Single-page Next.js 15 App Router app. One form, one API route, one Claude call.

### Request flow

1. User fills `ActivityForm` → POST to `/api/research`
2. API route calls Claude via the Anthropic SDK with the `mcp-client-2025-04-04` beta and the Notion MCP server (`https://mcp.notion.com/mcp`) attached as a remote tool server
3. Claude researches the activity using its knowledge, calls Notion MCP tools to create a formatted child page, then outputs enriched JSON
4. API extracts the JSON from the response text and returns it
5. Frontend renders `ResultCard` with all enriched fields

### Key files

| File | Purpose |
|------|---------|
| `app/api/research/route.ts` | The only server-side logic: builds the system prompt, calls Claude with Notion MCP, parses JSON from response |
| `components/ActivityForm.tsx` | Controlled form for the 6 input fields |
| `components/LoadingState.tsx` | Animated step indicator; cycles through labels on a timer while waiting (calls take 20–50s) |
| `components/ResultCard.tsx` | Displays all enriched fields after success |
| `lib/types.ts` | `ActivityFormData` and `EnrichedActivity` shared across client/server |

### Anthropic MCP beta

`mcp-client-2025-04-04` beta means the Anthropic API connects to the MCP server and executes all tool calls server-side. From the client's perspective it's a single `messages.create` call that returns when Claude is done — no client-side agentic loop needed.

The SDK call uses `(anthropic as any).beta.messages.create(...)` because `mcp_servers` and `betas` aren't in the published TypeScript types yet.

### Tailwind v4

No `tailwind.config.ts`. Config is just `@import "tailwindcss"` in `globals.css` and `@tailwindcss/postcss` in `postcss.config.mjs`.
