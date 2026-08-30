# [CLAUDE.md](http://CLAUDE.md)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build (also typechecks)
npm run lint       # ESLint
npm test           # Vitest, once
npm run test:watch # Vitest, watching

npm run db:generate # Emit a migration from lib/db/schema.ts
npm run db:migrate  # Apply pending migrations to Neon
npm run db:pull     # Introspect Neon (reference only — see Data model)
npm run db:studio   # Drizzle Studio
```

`drizzle-kit` runs outside Next.js, so `drizzle.config.ts` loads
`.env.local` itself via `dotenv`.

## Environment Setup

Copy `.env.example` to `.env.local` and populate every variable.

`lib/api/env.ts` parses and caches the four variables the app's own code
reads (`ANTHROPIC_API_KEY`, `NOTION_API_KEY`, `NOTION_PAGE_NAME`,
`DATABASE_URL`) and throws a `ConfigError` naming whatever is missing.
Parsing is lazy on purpose — throwing at module load would take down
middleware and every route rather than the one call that needs the key.
The `AUTH_*` variables are read by Auth.js directly and are not in that
schema.

## Architecture

Single-feature Next.js 15 App Router app: one input, one API route, one
agentic Claude run that writes to Notion.

### Data model

`lib/db/schema.ts` is the single source of truth — eleven tables, grouped
in the file by concern:

| Group | Tables |
| --- | --- |
| Access control | `allowed_emails` |
| Reference data | `countries`, `cities`, `activity_categories` |
| Trips | `trips`, `trip_destinations` |
| Itinerary | `itinerary_days` |
| Activities | `activities` |
| Ratings | `user_activity_ratings`, `user_category_ratings` |
| Audit | `ai_prompts` |

**There is no `users` table.** Ownership is the signed-in email, carried
as `user_email` and constrained against `allowed_emails`. Auth.js stores
no user rows — the allow-list *is* the user table. Don't add a `users`
table or an `owner_id`; join on the email.

Ten of these tables were hand-created against Neon before the repo had
migrations, so `drizzle/0000_*.sql` is a **descriptive no-op baseline**:
its body is commented out because the tables already existed. It is
recorded only so drizzle has a snapshot to diff against. A fresh database
must be bootstrapped by uncommenting that file first. Everything from
`0001` onward is real, generated, and applied.

- A day belongs to a **trip**, not to a `trip_destination`. On a
multi-city trip the city is derived by comparing the day's date against
each destination's arrive/depart range.
- `UNIQUE (trip_id, date)` on `itinerary_days` makes "one row per
calendar day" a database invariant, so day generation is a plain upsert.
- `activities.day_id` NULL is **by design** — it means an unscheduled
wishlist item, not missing data. Never filter it out by default and
never treat it as an error state.
- `activities.position` is nullable and means *unordered*, not first.
- Index operator classes in `schema.ts` (`text_ops` / `uuid_ops`) mirror
what is physically in Postgres, including a few that read as mismatched.
They are recorded, not chosen — "correcting" one emits a migration that
rebuilds the index.
- Joining activities to days uses LEFT JOIN. An INNER JOIN silently drops
every wishlist item, which reads as data loss rather than a bug.
- Deleting a day sets its activities' `day_id` to NULL (back to the
wishlist); deleting a trip cascades and destroys its activities. These
cascade rules are product decisions, not defaults — don't change them
to match a convention.
- All timestamps are `timestamptz`. The app spans time zones.
- Schema changes go through `db:generate` → review the emitted SQL →
`db:migrate`. Never hand-write DDL against Neon and never edit a
migration that has already been applied.



### Layers

Each directory is one layer. The rule that decides where code goes:
**a file in** `components/ui/` **or** `components/research/` **may not call** `fetch`**,
may not hold a** `useState` **that outlives a keystroke, and may not parse or
transform domain data.** Anything that does belongs in a hook, in `lib/`,
or in the orchestrator.


| Directory                      | Contains                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                         | Routes only. Thin — `app/page.tsx` is a server component that renders `PageShell` + `ResearchPanel`.                                                    |
| `components/ResearchPanel.tsx` | The **only** stateful orchestrator. Owns the request lifecycle, picks the view, does the one bit of data shaping the success view needs.                |
| `components/ui/`               | Presentational primitives: `PageShell`, `Wordmark`, `Card`, `Button` (+ `buttonStyles` for anchors), `ErrorBanner`, `icons`.                            |
| `components/research/`         | Presentational feature views. `ChatInput` is the one container here — it holds input-local draft state only and delegates rendering to `ChatInputView`. |
| `hooks/`                       | Behavior lifted out of components: `useResearch` (request lifecycle), `useAutoResizeTextarea`, `useRotatingIndex`.                                      |
| `lib/research/`                | Server-side domain: `taxonomy`, `prompt`, `agent`, `schema`, plus the client-safe `parse-reply`.                                                        |
| `lib/db/`                      | `schema.ts` (source of truth), `client.ts` (raw `getSql`), `index.ts` (adds Drizzle `getDb`). `@/lib/db` resolves to `index.ts`.                        |
| `lib/mcp/`                     | `notion-client.ts` — MCP transport and tool translation.                                                                                                |
| `lib/api/`                     | `env`, `errors`, `responses` (server) and `research-client` (browser).                                                                                  |
| `types/`                       | Ambient module augmentation (`next-auth.d.ts`).                                                                                                         |




### Request flow

1. `ChatInput` → `ResearchPanel` → `useResearch.submit`
2. `postResearch` (`lib/api/research-client.ts`) POSTs to `/api/research`
3. The route validates the body with `parseResearchRequest` and calls
  `runResearchAgent`
4. `runResearchAgent` spawns the Notion MCP subprocess, builds the system
  prompt, and hands both to `runAgentLoop`
5. `runAgentLoop` prompts Claude, executes any tool calls, and repeats until
  the model stops (bounded by `MAX_ITERATIONS`); the MCP subprocess is torn
   down in a `finally`
6. `ResearchPanel` runs `parseNotionPath` over the reply and renders
  `SuccessCardView`



### The agent loop

`runAgentLoop` takes an `AgentDeps` object (`listTools`, `createMessage`,
`callTool`) rather than reaching for clients itself, so the control flow is
tested with plain fakes in `lib/research/agent.test.ts`. `runResearchAgent`
is the thin wiring that supplies the real Anthropic client and MCP
subprocess.

Notion MCP runs as a **local stdio subprocess** (`@notionhq/notion-mcp-server`,
resolved from `node_modules/.bin`), not the remote `mcp.notion.com` server —
the local one accepts internal integration tokens (`ntn_...`) via
`OPENAPI_MCP_HEADERS`, where the remote one requires OAuth. Tool calls are
executed by our own loop, not server-side by the Anthropic API.

Tool failures come back as `is_error` tool results rather than throwing, so
the model can see them and adjust. Credential rejections are classified into
`UpstreamAuthError` at the MCP boundary — never by matching substrings
against an error message further up the stack.

### Errors

`lib/api/errors.ts` defines `AppError` subclasses that carry their own
status and code (`ValidationError` 400, `ConfigError` 500,
`UpstreamAuthError` 500). `lib/api/responses.ts` is the single place an
error becomes a status code and a user-facing string; route handlers never
branch on status.

### Auth

Google OAuth via Auth.js v5. `middleware.ts` gates every path except
`/login`, `/unauthorized`, and `api/auth`. Access is an allow-list:
`lib/auth/allowlist.ts` checks the `allowed_emails` table in Neon, the JWT
callback stores the result, and `types/next-auth.d.ts` augments `Session`
and `JWT` so `session.user.isAllowed` is typed rather than cast. The JWT
augmentation targets `@auth/core/jwt` — `next-auth/jwt` only re-exports the
interface, and augmenting a re-export does not merge.

### Styling

Tailwind v4, no `tailwind.config.ts`. Design tokens live in an `@theme`
block in `app/globals.css`: `canvas`, `surface`, `surface-raised`, `line`,
`line-strong`, and the `accent` / `accent-bright` / `accent-light` /
`accent-pale` ramp. **Components use these tokens** (`bg-surface`,
`border-line`, `bg-accent`) — do not reintroduce hardcoded hexes or
`white/10`.