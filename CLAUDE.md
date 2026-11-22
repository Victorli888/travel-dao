# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code), and to any other
coding agent, when working with code in this repository. It is the single
agent guide: `AGENTS.md` only points here, so put new rules in this file.

## Project docs

This file holds the invariants. Process and status live in `docs/`
(index: `docs/README.md`):

- **Before starting work**, read `docs/status.md` (where things are) and
  `docs/working-with-claude.md` (commits, what needs asking, what's never
  allowed).
- **Building a feature** follows `docs/development-workflow.md`, including its
  Definition of Done.
- **When a feature lands or a decision is made**, update `docs/status.md`.
  When a new code rule emerges, add it here, not in `docs/`.

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

Next.js 15 App Router app with two features and one route each:

| Route | Feature |
| --- | --- |
| `/` | The Itinerary Planning landing page. Static marketing, no data access. **The one public page**: `lib/auth/route-access.ts` matches it exactly — a prefix match on `/` would make every route public. |
| `/plan` | The Day Planner's front door. Name a trip, set its two dates, or reopen one you started. |
| `/plan/[tripId]` | One trip: a column per day, plus the Activity Bank — a read-only dialog over everything saved for the trip. Placing an activity on a day, creating one, and Plan It land here next. |
| `/write-to-notion` | One input, one API route, one agentic Claude run that writes to Notion. |

The Notion flow is described below and is unchanged. The planner has a full
data layer (`lib/itinerary/`) and the first screen on top of it.

**The planner has no API routes and should not grow any.** `/plan` and
`/plan/[tripId]` are Server Components that call `lib/itinerary/` directly,
and the one mutation is the Server Action in `app/plan/actions.ts`. See the
note in `lib/itinerary/index.ts`. The `ok()`/`fail()` envelope in
`lib/api/responses.ts` belongs to the Notion flow — it is typed to
`ResearchResponse` and does not generalise.

**Creating a trip and generating its days are two requests, on purpose.**
`createTripAction` performs exactly one write and redirects;
`/plan/[tripId]` reads the days and calls `generateDays` when it finds none.
This is the single-statement rule under Data model, applied across a
boundary: the Neon HTTP driver has no interactive transactions, so a second
write in the action could half-fail in silence. `generateDays` is one
`INSERT ... ON CONFLICT DO NOTHING`, which makes the page idempotent and a
reload a retry. Merging them back into the action would look tidier and
would reintroduce exactly the failure the rule exists to prevent.

### Data model

`lib/db/schema.ts` is the single source of truth — **five tables**,
grouped in the file by concern:

| Group | Tables |
| --- | --- |
| Access control | `allowed_emails` |
| Trips | `trips` |
| Itinerary | `day_itineraries`, `day_itinerary_activities` |
| Activities | `activities` |

**The schema is scoped to itinerary planning and nothing else.** Migration
`0003` dropped seven tables — `countries`, `cities`, `activity_categories`,
`trip_destinations`, `user_activity_ratings`, `user_category_ratings` and
`ai_prompts`. Read that migration's header before adding anything back; it
records what each one gave up. Their contents were snapshotted to
`scratch/dropped-tables-backup-2026-08-30.json`.

Three consequences worth knowing before you design against this:

- **A trip has no geography.** No country, no city, no destination. A day is
a trip and a date; where the traveller is that day is not recorded, and any
UI that wants it must get it from the activities placed on the day.
- **Nothing records rejection.** `user_activity_ratings.status` used to
suppress a suggestion without deleting it. With it gone the agent cannot
know what was already turned down.
- **No prompt audit log.**

**There is no `users` table.** Ownership is the signed-in email, carried
as `user_email` and constrained against `allowed_emails`. Auth.js stores
no user rows — the allow-list *is* the user table. Don't add a `users`
table or an `owner_id`; join on the email.

`drizzle/0000_*.sql` is a **descriptive no-op baseline**: its body is
commented out because the ten tables it names were hand-created against Neon
before the repo had migrations. It is recorded only so drizzle has a snapshot
to diff against. Bootstrapping a fresh database means uncommenting it, then
running `0001`-`0004` — which will create seven tables and immediately drop
them again. Everything from `0001` onward is real, generated, and applied.

- `UNIQUE (trip_id, date)` on `day_itineraries` makes "one row per
calendar day" a database invariant, so day generation is a plain upsert.
- **`day_itinerary_activities` is a join table, and the scheduling is
there — not on `activities`.** Day↔activity is many-to-many: the same
activity can sit on several days (a two-day park ticket). An activity is
one row with one identity, placed onto N days by N rows here. Never
reintroduce `activities.day_id`; cloning the activity per day duplicates
the place's identity, its `priority_score` and every edit to it.
- An activity with **no** placement row is an unscheduled wishlist item —
by design, not missing data. Never filter it out by default and never
treat it as an error state. The test is `NOT EXISTS (... )`, not a NULL
column.
- **`day_itineraries.name` is a user-given label, and NULL means *unnamed*.**
A day's identity is still `(trip_id, date)` — the name is decoration the UI
falls back from to the date. Clearing one is an explicit `null`, never `""`;
`DayNameSchema` rejects the empty string so there is one spelling of the
state. The 200-character cap lives in Zod, not in the column.
- `day_itinerary_activities.position` is nullable and means *unordered*,
not first. It lives on the placement, not the activity, because ordering
is a property of the pairing — the same activity is first on one day and
third on another.
- `UNIQUE (day_id, activity_id)` blocks the same activity twice on one
day: a morning visit plus an evening return is one row and a note, not
two rows. That is a product call, reversible with a one-line migration.
- `activities.priority_score` is an integer 1-5 (`CHECK` enforced), and
**NULL means not yet prioritised, not lowest**. It replaces the 0-10
`user_activity_ratings.rating`; sort with `NULLS LAST`.
- **`activities.area` is the neighbourhood, and it is not a slice of
`address`.** "Pontochō", not "Kamogawa Park, Nakagyō-ku, Kyoto 604-8006". It
is the Activity Bank's second line, and NULL means *not recorded* — the row
omits the line rather than filling it. Deriving one from the other by
splitting on commas is inventing geography by substring, which is the thing
migration `0003` removed. The Claude lookup on the new-activity flow is what
populates it; until then every row is NULL, which is correct, not missing.
- Index operator classes in `schema.ts` (`text_ops`) mirror what is
physically in Postgres. They are recorded, not chosen — "correcting" one
emits a migration that rebuilds the index.
- Reading days joins through the placement table, and both hops are LEFT
JOIN — one so a day with nothing planned still comes back, one so the
row survives. An INNER JOIN silently drops every empty day and every
wishlist item, which reads as data loss rather than a bug.
- Deleting a day cascades its placements and leaves the activities alone
— they fall back to the wishlist. Deleting a trip cascades and destroys
its activities outright. These cascade rules are product decisions, not
defaults — don't change them to match a convention.
- All timestamps are `timestamptz`. The app spans time zones.
- **`date` columns are bare `YYYY-MM-DD` and must be formatted in UTC.**
`new Date("2026-04-12")` parses as UTC midnight, so an `Intl.DateTimeFormat`
without `timeZone: "UTC"` renders the *previous* day for every reader west of
Greenwich. `lib/itinerary/format.ts` is the one place this is done — use it
rather than formatting a date inline. `eachDate` in `days.ts` steps in UTC
for the same reason, and `vitest.config.ts` pins `TZ` to a western zone so a
dropped `timeZone` fails a test instead of shipping.
- Nothing stops a placement pairing a day from one trip with an activity
from another — `day_itinerary_activities` has independent FKs and no
constraint ties them to the same trip. `sql/validate-itinerary.sql` check 9
demonstrates it. Closing it needs a composite FK carrying `trip_id`.
- **Every mutation in `lib/itinerary/` is a single SQL statement.** The Neon
HTTP driver has no interactive transactions — `db.transaction()` on
`neon-http` only takes the array-batch form — so a multi-statement write
that half-fails leaves a trip with four days and no error anywhere. Day
generation is one multi-row `INSERT ... ON CONFLICT DO NOTHING`; placements
are one `INSERT ... SELECT` whose JOIN through `trips` *is* the
authorization check. A read before a write is fine (nothing is written yet);
a second write is not. Needing genuine multi-statement atomicity is the
trigger to adopt `drizzle-orm/neon-serverless`, not to write a bare
sequence.
- **`lib/itinerary/` enforces what `day_itinerary_activities` cannot.** The
join table has two independent FKs and no composite key carrying `trip_id`,
so `placements.ts` proves same-trip in its JOIN. That is a weaker guarantee
than the database's, and `sql/validate-itinerary.sql` check 9 will keep
reporting the gap until a migration closes it.
- **``db.execute(sql`...`)`` bypasses Drizzle's column mappers.** The
neon-http driver disables Postgres' own timestamp parsers and relies on
those mappers, so a `created_at` read through `db.execute` is a string, not
a `Date`. The guarded inserts in `placements.ts` return only an id and
re-select the row through the builder for exactly this reason.
- Schema changes go through `db:generate` → review the emitted SQL →
`db:migrate`. Never hand-write DDL against Neon and never edit a
migration that has already been applied. Note `db:migrate` **swallows
errors and exits 1 silently** — if it prints no success line, replay the
migration through `psql` to see the actual failure.



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
| `components/planner/`          | Presentational views for `/plan`. Same rule as `components/research/`, and **two** containers hold to it: `NewTripForm` (the three field values, to decide whether submit is live, plus the `useActionState` lifecycle) and `ActivityBank` (a draft search string and two refs). Each delegates rendering to its `*View`. `fieldStyles.ts` is the shared form-control class strings, in the spirit of `buttonStyles`. |
| `components/landing/`          | Presentational sections of `/`. Same rule as `components/ui/`, and stricter in practice: nothing here is a client component, so the landing ships as markup with no page JS. |
| `hooks/`                       | Behavior lifted out of components: `useResearch` (request lifecycle), `useAutoResizeTextarea`, `useRotatingIndex`.                                      |
| `lib/research/`                | Server-side domain: `taxonomy`, `prompt`, `agent`, `schema`, plus the client-safe `parse-reply`.                                                        |
| `lib/db/`                      | `schema.ts` (source of truth), `client.ts` (raw `getSql`), `index.ts` (adds Drizzle `getDb`). `@/lib/db` resolves to `index.ts`.                        |
| `lib/itinerary/`               | The itinerary data access layer. Split by entity (`trips`, `days`, `activities`, `placements`) plus pure `shape`/`schemas`/`format`/`bank` and a `pg-errors` translator. `server-only`; `userEmail` on every signature. |
| `lib/auth/`                    | `allowlist.ts` (is this email in `allowed_emails`) and `session.ts` (`requireUserEmail`, the signed-in email every `lib/itinerary/` call needs first). |
| `lib/mcp/`                     | `notion-client.ts` — MCP transport and tool translation.                                                                                                |
| `lib/api/`                     | `env`, `errors`, `responses` (server) and `research-client` (browser).                                                                                  |
| `types/`                       | Ambient module augmentation (`next-auth.d.ts`).                                                                                                         |
| `sql/`                         | Raw-SQL validation against the schema. `validate-itinerary.sql` builds a fake trip, asserts the Data model invariants above, and ROLLBACKs — it writes nothing and is never imported by app code. |

**`lib/itinerary/index.ts` carries `server-only`, so the pure modules are
imported by path — and for `bank.ts` that is load-bearing.** `shape`, `format`
and `pg-errors` are deep-imported by convention; `bank.ts` must be, because
`filterBankEntries` runs in the browser on every keystroke. A barrel import of
it compiles and then fails at runtime.

**The Activity Bank keeps no React `open` flag.** `ActivityBank` calls
`showModal()` on a ref and lets the native `<dialog>` own its openness, so Esc
and a React state variable cannot disagree; the dialog's `close` event is the
one place every dismissal lands. That is also why the container stays inside
the layer rule — a draft search string and two refs, nothing that outlives a
keystroke. `<dialog>` then needs three things spelled out that are easy to undo:
display utilities must be `open:`-prefixed (a bare `flex` outranks the UA's
`display: none` and pins it open), the ground must be set explicitly (the UA
paints `dialog` with `Canvas`/`CanvasText`, so `.tao-ground` does not reach in,
and `::backdrop` inherits nothing), and padding belongs on the inner sections,
since a backdrop click targets the `<dialog>` element itself.

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
block in `app/globals.css`. **Components use these tokens** (`bg-surface`,
`border-line`, `bg-tao`) — do not reintroduce hardcoded hexes or `white/10`.

There are **two palettes**, and they are separately named rather than swapped
behind a theme switch. The roles do not map across grounds — `accent-pale` is
legible text on dark and a wash on light — so one set of names carrying both
would silently produce unreadable pairings. Which family a component uses is
also how you tell, by reading it, which half of the app it belongs to.

| Family | Tokens | Used by |
| --- | --- | --- |
| Dark | `canvas`, `surface`, `surface-raised`, `line`, `line-strong`, `accent` / `accent-bright` / `accent-light` / `accent-pale` | `/write-to-notion` and the auth pages |
| Light | `paper` / `paper-raised`, `ink` / `ink-muted` / `ink-subtle`, `rule` / `rule-strong`, `tao` / `tao-bright` / `tao-soft` / `tao-wash`, `sky`, `ember` | `/` and `/plan` |

The light family comes from the Day Planner design system. Two conventions
in it are load-bearing rather than decorative:

- **`ember` is the second accent, spent on one action per page.** On the
  landing that action is "Start planning": the `ember` button variant in the
  hero and again in the closing block, plus tiny marks (the hero's plane and
  eyebrow dot). Nothing else gets it. Spending it more widely is what makes
  the first accent stop reading as an accent. Ember is a fill, never text:
  the button carries `ink` text because white on ember fails contrast.
- **`sky` is decorative only** — washes (`bg-sky/10`), borders, illustration
  strokes, and text on the navy block. As text on white it fails contrast.
- **Freestanding rules fade out at both ends** over one 48px baseline unit —
  the `.rule-fade` class in `globals.css`. Box outlines and in-control
  separators stay square; those are `border-rule`.

`body` paints the dark ground. A light page puts `tao-ground` on its outermost
element, and `body:has(.tao-ground)` swaps the whole ground — the `:has()` rule
exists so nothing bleeds through at the overscroll edges, which a wrapper
`<div>` cannot prevent.

`paper` is plain white, so a panel that needs to read as raised takes
`paper-raised` plus `border-rule` — there is deliberately no third near-white
token, because one that equalled the ground would look like a surface in the
palette and render as nothing on the page.

Inter is loaded in `app/layout.tsx` as `--font-inter` and reaches only what
asks for it via `font-tao`; the dark pages keep the system stack.