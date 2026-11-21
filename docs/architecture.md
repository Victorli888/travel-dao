# Architecture overview

> Owns: the map, meaning how the pieces fit and where new code goes. Does not
> own: the rules. Those are in `CLAUDE.md`, which wins any disagreement.
> Sections below name the `CLAUDE.md` heading to read for detail.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 (tokens in
`app/globals.css`) · Auth.js v5 (Google) · Neon Postgres over the HTTP driver
· Drizzle ORM + drizzle-kit · zod · Vitest · Anthropic SDK + Notion MCP.

## Routes

| Route | Kind | What it does |
| --- | --- | --- |
| `/` | Server Component, no JS | Landing page (`components/landing/`) |
| `/plan` | Server Component + Server Action | Trip list and new-trip form. Action: `app/plan/actions.ts` → `createTripAction` |
| `/plan/[tripId]` | Server Component | One trip: day columns plus the Activity Bank |
| `/write-to-notion` | Client orchestrator | `ResearchPanel` → `POST /api/research` |
| `/api/research` | Route Handler | The only API route besides auth. It runs the agent. |
| `/login`, `/unauthorized`, `/api/auth/*` | Auth | The only paths `middleware.ts` leaves open |

## How a request flows

```
Day Planner (no API routes, on purpose)

  page.tsx (Server Component) ──read──▶ lib/itinerary/* ──▶ Neon
        │  requireUserEmail()            (server-only, userEmail on every call)
        ▼
  components/planner/<X>.tsx (container: draft state, refs)
        ▼
  components/planner/<X>View.tsx (pure view)
        │  form submit
        ▼
  app/plan/actions.ts (Server Action) ──write──▶ lib/itinerary/* ──▶ Neon
        └── redirect / revalidate

Write to Notion

  ChatInput → ResearchPanel → useResearch → POST /api/research
     → parseResearchRequest (zod) → runResearchAgent
        ├─ spawn local Notion MCP subprocess (stdio)
        └─ runAgentLoop: Claude ⇄ tools, ≤ MAX_ITERATIONS
     → parseNotionPath → SuccessCardView
```

Detail: `CLAUDE.md` → *Request flow*, *The agent loop*.

## Data model

```
allowed_emails (email PK)  ◀── the user table. There is no `users` table.
      ▲ user_email                       ▲ user_email
      │                                  │
   trips ───1:N──▶ day_itineraries       activities ◀──N:1── trips
   (name, status,  (trip_id, date        (name, summary, address, area,
    start/end)      UNIQUE, name)          lat/lng, priority_score 1–5, …)
                         │                      │
                         └──▶ day_itinerary_activities ◀──┘
                              (day_id, activity_id UNIQUE, position)
                              many-to-many "placement"
```

Five tables, defined in `lib/db/schema.ts` (the source of truth). The
invariants are in `CLAUDE.md` → *Data model*. Read them before touching any of
this.

## Where new code goes

The full table is in `CLAUDE.md` → *Layers*. The short version:

| You're writing… | Put it in |
| --- | --- |
| A page | `app/<route>/page.tsx`. Keep it thin and have it call `lib/` directly. |
| A planner mutation | A Server Action in `app/plan/actions.ts`, calling `lib/itinerary/` |
| A DB read or write | `lib/itinerary/<entity>.ts`, exported from `lib/itinerary/index.ts` |
| Pure domain logic the browser also needs | A pure module in `lib/itinerary/` (like `bank.ts`), deep-imported by path, **never** through the barrel |
| Input validation | zod in `lib/itinerary/schemas.ts` |
| A planner screen | `components/planner/`: a container holding only draft state, plus a pure `*View` |
| A shared primitive | `components/ui/` |
| A schema change | `lib/db/schema.ts` → `npm run db:generate` → review → `npm run db:migrate` ([drizzle.md](drizzle.md)) |

The rule that decides it: files in `components/ui/`, `components/research/`
and `components/planner/` views **may not** call `fetch`, hold state that
outlives a keystroke, or transform domain data.

## Decisions worth knowing before you change anything

Each has a reason that isn't obvious from the code. The detail is in
`CLAUDE.md`.

1. **Every write is one SQL statement.** The Neon HTTP driver has no
   transactions, so a two-statement write can half-fail silently. Needing real
   atomicity means switching to `drizzle-orm/neon-serverless`, not writing a
   sequence.
2. **The planner has no API routes.** Server Components read, Server Actions
   write.
3. **Creating a trip and generating its days are two requests.** That's the
   single-statement rule applied across a redirect, which makes reload a
   retry.
4. **`lib/itinerary/index.ts` is `server-only`.** Pure modules a client
   needs are imported by path.
5. **Ownership is checked in the query.** Drizzle has no row-level security.
   A forgotten `where user_email = …` is a data leak.
6. **Dates are bare `YYYY-MM-DD`, formatted in UTC** via
   `lib/itinerary/format.ts`. Tests run in `America/Los_Angeles` to catch
   a missing `timeZone`.
7. **Two palettes, never mixed**: dark for Notion/auth, light (`tao`, `ink`,
   `paper`, …) for `/` and `/plan`. `ember` at most once per page.
   `CLAUDE.md` → *Styling*.
