# Project status

**Last updated: 2026-11-21.**
Update this when a feature lands, a decision is made, or a branch is merged.
Change the date when you do.

> Owns: where the project is right now. Does not own: how things work
> ([architecture.md](architecture.md)) or the rules (`CLAUDE.md`).

---

## Branch state

| Branch | State |
| --- | --- |
| `main` | The Notion research app, plus auth (PR #3) and the layered-architecture refactor. |
| `feat/itinerary-planning` | **Active, being merged.** 30 commits ahead of `main`, 0 behind, all pushed. The PR to `main` is "Planner, part 1". Merging before you can add an activity from the UI was decided on 2026-11-21; see [After merging to `main`](#after-merging-to-main). |
| `refactor/layered-architecture`, `feat/auth-login`, `docs/consolidate-agent-docs` | Already merged (the last via PR #4, into `feat/itinerary-planning`). Safe to delete. |

`feat/brainstorm` (AI activity generation, built on tables that `0003`
dropped) no longer exists locally or on `origin`.

---

## Done (committed on `feat/itinerary-planning`)

- **Schema cut to itinerary planning only.** Migration `0003` dropped seven
  tables, leaving five: `allowed_emails`, `trips`, `day_itineraries`,
  `day_itinerary_activities`, `activities`. Backups are in `scratch/`.
- **The data layer, `lib/itinerary/`.** Trips, days, activities, placements,
  reordering, naming a day. Every write is a single SQL statement. Tests:
  `shape`, `schemas`, `format` and `pg-errors` are pure unit tests, and
  `crud.test.ts` is the live database suite.
- **Landing page at `/`.** The Notion tool moved to `/write-to-notion`.
- **`/plan`**: create a trip (name + two dates) or reopen one. Wireframe
  Frame 0.
- **`/plan/[tripId]`**: one column per day, listing the activities placed on
  it. Days are generated on first view.
- **The Activity Bank** (wireframe Frame 1): a read-only dialog over every
  activity saved for the trip, with search that ignores accents. It brought the
  `activities.area` column (the neighbourhood), migration
  `drizzle/0009_ambiguous_the_anarchist.sql`, `lib/itinerary/bank.ts` and
  `components/planner/ActivityBank*.tsx`.
- **Docs.** `CLAUDE.md` is the single agent guide (`AGENTS.md` points to it),
  `docs/` holds only feature-work context, and `.github/pr-template.md` is
  the PR description format (PR #4).

## After merging to `main`

The 2026-11-21 merge goes ahead knowingly with these open. Do them first, in
this order:

1. **Verify the merge.** None of these were run before merging:
   - `npm test`, `npm run lint` and `npm run build`. The last recorded pass is
     from 2026-11-11, before the Activity Bank was committed.
   - Confirm migration `0009` is applied to Neon. If it isn't,
     `/plan/[tripId]` fails when it selects `area`:
     `SELECT column_name FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'area';`
     No row means you should run `npm run db:migrate`. It fails without
     printing an error, so if there's no success line, replay the migration
     through `psql`.
   - In a browser: sign in, create a trip, open it, open the Activity Bank, and
     check that `/write-to-notion` still works at its new path.
2. **Know the planner is incomplete on `main`.** You can create trips and see
   their days, but nothing in the UI can add an activity yet, so the Activity
   Bank is always empty. "Next, in order" items 1 and 2 below fix that.

## Next, in order

1. **Place an activity on a day** from the UI. `placeActivityOnDay` /
   `appendActivityToDay` already exist; this needs a Server Action and UI.
2. **Create an activity**, the Activity Modal (Frame 3, "Save It").
   `addActivity` + `ActivityDraftSchema` exist.
3. **Plan It**, the Itinerary Day (Frame 2).
4. **Drag-to-reorder within a day.** `reorderDay` already renumbers a day in
   one statement.

## Open decisions

| Decision | Status | Where it's written up |
| --- | --- | --- |
| **Step 0**: should the research agent save activities to Postgres (A, recommended) or keep writing only to Notion (B)? | Open. Not blocking yet, but it blocks rejection memory. | [Step 0](#step-0-where-the-research-agent-saves) below |
| **Rejection memory**: remember activities the user turned down so they aren't suggested again. | Open. Needs Step 0 = A first. | `CLAUDE.md` → Data model ("Nothing records rejection") |
| **Activity identity key**: the same real place regenerated becomes a second row. | Open. Decide alongside Step 0. | [Activity identity key](#activity-identity-key) below |
| **Composite FK** so a placement can't pair a day and an activity from different trips. | Open. The data layer enforces it for now. | `CLAUDE.md` → Data model; `sql/validate-itinerary.sql` check 9 |

### Step 0: where the research agent saves

Today the agent's system prompt says "Notion is the source of truth."
`runResearchAgent` returns prose and `parseNotionPath` scrapes a URL out of
it. Nothing lands in Postgres, but the planner needs rows in `activities`.

| Option | What it means | Cost |
| --- | --- | --- |
| **A: Postgres primary** | The agent gains a structured-output step (a tool call returning JSON in the activity shape) and the route inserts it into `activities`. Notion becomes a side effect. | Prompt rewrite, a new zod schema, a write path in the route. |
| **B: Postgres secondary** | Postgres holds only what the user adds by hand. The agent keeps writing prose to Notion. | Cheap now. Blocks rejection memory: the agent never produces a row to score. |

**Recommendation: A.** Rejection memory ("once an activity is scored poorly,
don't generate it again") is impossible under B, and re-adding a ratings table
only makes sense once activities are real rows with stable identity.

### Activity identity key

The same real-world place regenerated by the agent becomes a new `activities`
row with a new uuid, so a previously rejected place can be suggested again.
Fixing it needs an identity key on `activities` (a normalised name + address,
or the `source_metadata` provider id) plus a partial unique index. It does not
touch the itinerary tables.

## Loose ends

- No React component tests. Views are verified by browser only.
- Deployment is unproven (the MCP subprocess vs serverless). See the README
  "Known gaps".
