# Dao 道

A personal travel planner:

- **Day Planner** (`/plan`): plan a trip day by day. Name a trip, set its dates,
  get one column per day, and keep every activity saved for the trip in an
  Activity Bank. Its data lives in Neon Postgres.
- **Research a place** (`/plan/[tripId]/add`): describe a place in one line;
  Claude confirms what's at that address, summarises it, and saves it to that
  trip's activity bank.

For research, you type
`Patisserie Rau, 169 Higashiyama, Yamashina Ward, Kyoto 607-8322, Japan`.
Claude confirms what actually sits at that address, writes a summary and opening
hours, and inserts an `activities` row. The activity bank is the source of truth.

`/` is a landing page that introduces the planner.

---

## Current features

**Day Planner** *(in progress: see `docs/status.md`)*
- Create a trip from a name and two dates, or reopen one you started.
- Each trip gets one column per calendar day, generated the first time you open
  it. A day can be given a name; without one it shows its date.
- The Activity Bank lists every activity saved for the trip, with search that
  ignores accents. Research adds new ones from `/plan/[tripId]/add`.
- Not built yet: placing an activity on a day from the UI, and reordering a day.
  The data layer for both exists in `lib/itinerary/`.

**Research and save a place**
- One free-form input: place name plus full address.
- The address is treated as ground truth. A name alone is ambiguous — "Kamekichi"
  could be a watch shop, a ramen bar, or a craft store — so the business type is
  confirmed against the address before anything is saved.
- Produces a canonical name, confirmed address, neighbourhood (`area`), a 2–4
  sentence summary, and opening hours. Anything unverifiable is labeled as such
  rather than guessed.
- Claude submits via a host tool (`submit_activity`); the route calls
  `addActivity` and returns the saved row.

**Access control**
- Google OAuth via Auth.js. Every route except `/login`, `/unauthorized`, and
  `api/auth` is gated by middleware.
- Sign-in alone is not enough — the email must appear in an `allowed_emails`
  table. Anyone else lands on `/unauthorized` with a request-access link.

**Interface**
- Auto-growing input with rotating example placeholders.
- Optimistic progress indicator during the research call.
- Success card showing the activity that landed in the bank.

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 15.5 (App Router), React 19.2 |
| Language | TypeScript 5.9 (strict) |
| Styling | Tailwind CSS 4.2 — no config file; tokens live in an `@theme` block in `app/globals.css` |
| Auth | Auth.js / next-auth 5.0.0-beta.31, Google provider |
| Database | Neon serverless Postgres (`@neondatabase/serverless` 1.1), Drizzle ORM 0.45 + drizzle-kit 0.31 |
| AI | `@anthropic-ai/sdk` 0.40, model `claude-haiku-4-5-20251001` |
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
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |

`lib/api/env.ts` validates `ANTHROPIC_API_KEY` and `DATABASE_URL` with zod and
fails loudly, naming whatever is missing. The `AUTH_*` variables are read by
Auth.js itself.

### Set up the database

The schema lives in `lib/db/schema.ts` and migrations in `drizzle/`:

```bash
npm run db:migrate
```

Note that `drizzle/0000_*.sql` is a **descriptive no-op baseline** — its body
is commented out, because those ten tables were hand-created against Neon
before this repo had migrations. Against an existing database it applies
nothing and simply records the starting point. For a **fresh** database,
uncomment that file's body before running the command above — note that
`0003` then drops seven of those ten again, leaving the five-table
itinerary-planning schema.

Then add yourself to the allow-list — signing in with Google is not enough:

```sql
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

npm run db:generate # emit a migration from lib/db/schema.ts
npm run db:migrate  # apply pending migrations
npm run db:studio   # Drizzle Studio
```

Sign in at `/login` with an allow-listed Google account. Plan a trip at `/plan`,
then research a place from a trip via **Add activity**.

---

## How it works

**Day Planner.** `/plan` and `/plan/[tripId]` are Server Components that call
`lib/itinerary/` directly, and writes are Server Actions. Every write is a
single SQL statement, because the Neon HTTP driver has no interactive
transactions. `CLAUDE.md` → *Data model* has the rules.

**Research → activity bank:**

```
ChatInput → ResearchPanel → useResearch.submit(tripId)
          → POST /api/research { message, tripId }
          → parseResearchRequest → requireUserEmail → runResearchAgent
               └─ runAgentLoop  ⟳ prompt → submit_activity → repeat
          → addActivity → SuccessCardView
```

The codebase is organised by layer, and `components/ResearchPanel.tsx` is the
only stateful research orchestrator — everything under `components/ui/` and
`components/research/` is presentational. `CLAUDE.md` documents the layer map.

---

## Pending features

Nothing here is scheduled — this is the parking lot.

**Known gaps**
- [ ] No test coverage on the React layer. Closing this means adding a React
      test environment (`@vitejs/plugin-react` + jsdom).
- [ ] Research route `maxDuration = 120` needs a deploy target that permits
      long function timeouts.
- [ ] `UpstreamAuthError` returns 500 where 502 is more accurate.
- [ ] `git merge` / `git rebase` are unguarded relative to the commit policy in
      `docs/working-with-claude.md`.

**Ideas**
- [ ] Activity identity key so regenerating the same place does not create a
      duplicate row.
- [ ] Rejection memory so poorly scored places are not suggested again.
- [ ] Bulk entry — paste several places at once.
- [ ] Edit or correct an entry after it is written.
- [ ] Self-serve access requests rather than a mailto link.

---

## Reference

- `docs/README.md` — the project docs index: status, product, architecture,
  development workflow, and the ground rules for working with Claude.
- `CLAUDE.md` — architecture guidance for working in this repo.
