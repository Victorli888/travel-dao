# Dao 道

Describe a place in one line and it lands in your Notion travel planner, researched
and filed under the right city and category.

You type `Patisserie Rau, 169 Higashiyama, Yamashina Ward, Kyoto 607-8322, Japan`.
Claude confirms what actually sits at that address, writes a summary and opening
hours, picks a category, and creates the Notion entry at
`Kyoto > Good Eats > Dessert > Patisserie Rau`. Notion is the source of truth —
the app itself stores nothing but the allow-list of who may sign in.

---

## Current features

**Research and file a place**
- One free-form input: place name plus full address.
- The address is treated as ground truth. A name alone is ambiguous — "Kamekichi"
  could be a watch shop, a ramen bar, or a craft store — so the business type is
  confirmed against the address before anything is written.
- Produces a canonical name, confirmed address, a 2–4 sentence summary, and
  opening hours. Anything unverifiable is written as "Unknown / not verified"
  rather than guessed.

**Automatic categorisation**
- One top-level category and one subcategory from a fixed taxonomy
  (`lib/research/taxonomy.ts`): Good Eats, Shopping & Markets, Activities.
- The category follows the confirmed business type, not the name — a watch store
  files under Shopping & Markets no matter what its name sounds like.

**Notion writing over MCP**
- Finds or creates the city page under your planner page, ensures the category
  toggles exist, and adds the entry as a nested toggle.
- Runs as a real agentic loop: Claude calls Notion MCP tools, sees the results,
  and adjusts. Tool failures come back to the model as errors so it can recover
  instead of aborting the run.

**Access control**
- Google OAuth via Auth.js. Every route except `/login`, `/unauthorized`, and
  `api/auth` is gated by middleware.
- Sign-in alone is not enough — the email must appear in an `allowed_emails`
  table. Anyone else lands on `/unauthorized` with a request-access link.

**Interface**
- Auto-growing input with rotating example placeholders.
- Optimistic progress indicator during the 20–50 second call.
- Success card showing the Notion breadcrumb it wrote to.

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 15.5 (App Router), React 19.2 |
| Language | TypeScript 5.9 (strict) |
| Styling | Tailwind CSS 4.2 — no config file; tokens live in an `@theme` block in `app/globals.css` |
| Auth | Auth.js / next-auth 5.0.0-beta.31, Google provider |
| Database | Neon serverless Postgres (`@neondatabase/serverless` 1.1) — allow-list only |
| AI | `@anthropic-ai/sdk` 0.40, model `claude-haiku-4-5-20251001` |
| Tools | `@modelcontextprotocol/sdk` 1.29 + `@notionhq/notion-mcp-server` 2.2 over stdio |
| Validation | zod 4.4 (request body and environment) |
| Tests | Vitest 3.2, node environment |

Runtime limits, all in `lib/research/agent.ts` and `app/api/research/route.ts`:
`max_tokens` 2048, `MAX_ITERATIONS` 15 agent turns, route `maxDuration` 120s.
Request bodies are bounded at 3–500 characters.

---

## Running it

### Prerequisites

- Node.js 20 or newer (developed on 23.11).
- An [Anthropic API key](https://console.anthropic.com/).
- A Notion internal integration token (`ntn_…`) from
  [notion.so/my-integrations](https://www.notion.so/my-integrations), **shared with
  your planner page** — the integration cannot see pages you have not explicitly
  connected it to.
- A [Neon](https://console.neon.tech/) Postgres database.
- Google OAuth credentials from the
  [Google Cloud console](https://console.cloud.google.com/), with
  `http://localhost:3000/api/auth/callback/google` as an authorised redirect URI.

### Setup

```bash
npm install
cp .env.example .env.local   # then fill in every value
```

| Variable | What it is |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `NOTION_API_KEY` | Notion integration token, shared with your planner page |
| `NOTION_PAGE_NAME` | Exact title of the parent Notion page (default `Travel Planner`) |
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |

`lib/api/env.ts` validates the first four with zod and fails loudly, naming
whatever is missing. The `AUTH_*` variables are read by Auth.js itself.

### Create the allow-list table

There are no migration files in this repo. The table is whatever satisfies the
query in `lib/auth/allowlist.ts`, which is minimally:

```sql
CREATE TABLE allowed_emails (
  email TEXT PRIMARY KEY
);

INSERT INTO allowed_emails (email) VALUES ('you@example.com');
```

Emails are lower-cased before lookup, so store them lower-case.

### Commands

```bash
npm run dev         # dev server at http://localhost:3000
npm run build       # production build (also typechecks)
npm start           # serve the production build
npm run lint        # ESLint
npm test            # Vitest, once
npm run test:watch  # Vitest, watching
```

Sign in at `/login` with an allow-listed Google account, then submit a place.
The first call takes 20–50 seconds.

---

## How it works

```
ChatInput → ResearchPanel → useResearch.submit
          → POST /api/research
          → parseResearchRequest (zod)  →  runResearchAgent
                                             ├─ spawn Notion MCP subprocess
                                             ├─ buildSystemPrompt (taxonomy injected)
                                             └─ runAgentLoop  ⟳ prompt → tools → repeat
          → parseNotionPath → SuccessCardView
```

The codebase is organised by layer, and `components/ResearchPanel.tsx` is the only
stateful orchestrator — everything under `components/ui/` and
`components/research/` is presentational. `CLAUDE.md` documents the layer map, the
rule that decides where new code goes, and a couple of gotchas worth reading before
you touch auth or the MCP client.

Notion MCP runs as a **local stdio subprocess**, not the remote `mcp.notion.com`
server, because the local one accepts internal integration tokens while the remote
one requires OAuth. Tool calls are executed by our own loop rather than server-side
by the Anthropic API.

---

## Pending features

Nothing here is scheduled — this is the parking lot.

**Known gaps**
- [ ] No test coverage on the React layer. `ResearchPanel`, the three hooks, and
      the views are verified by screenshot only; closing this means adding a React
      test environment (`@vitejs/plugin-react` + jsdom).
- [ ] Deployment is unproven. `lib/mcp/notion-client.ts` resolves the MCP server
      from `node_modules/.bin` and spawns a child process, which does not
      obviously survive a serverless target. `maxDuration = 120` also needs a plan
      that permits long function timeouts.
- [ ] `UpstreamAuthError` returns 500 where 502 is more accurate.
- [ ] `git merge` / `git rebase` are unguarded relative to the commit policy in
      `CHANGELIST.md`.
- [ ] `tsconfig.tsbuildinfo` is tracked in git and churns on every build.

**Ideas**
- [ ] Read back from Notion — list or search what you have already saved, instead
      of the app being write-only.
- [ ] Reuse `TAXONOMY` in the UI for category filters; it is currently server-only.
- [ ] Bulk entry — paste several places at once.
- [ ] Edit or correct an entry after it is written.
- [ ] Self-serve access requests rather than a mailto link.

---

## Reference

- `CHANGELIST.md` — the layered-architecture refactor: what changed, why, and the
  tradeoffs behind each decision.
- `CLAUDE.md` — architecture guidance for working in this repo.
