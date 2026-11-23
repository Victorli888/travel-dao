# Project status

**Last updated: 2026-11-22.**
Update this when a feature lands, a decision is made, or a branch is merged.
Change the date when you do.

> Owns: where the project is right now. Does not own: how things work
> ([architecture.md](architecture.md)) or the rules (`CLAUDE.md`).

---

## Branch state

| Branch | State |
| --- | --- |
| `main` | The Day Planner, auth, and the original Notion research app. |
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
- **Landing page at `/`.** Introduces the Day Planner.
  Redesigned on 2026-11-22 (`feat/landing-page-redesign`): hero with a route
  illustration, benefits, three steps, planner features, and a closing call to
  action. Still wholly static. **`/` is public** (exact match in
  `lib/auth/route-access.ts`); every other route stays behind sign-in. Its
  CTAs link to `/plan`, so a signed-out visitor is redirected to `/login`.
- **`/plan`**: create a trip (name + two dates) or reopen one. Wireframe
  Frame 0.
- **`/plan/[tripId]`**: one card per day, listing the activities placed on
  it. Days are generated on first view. Restyled to the landing on 2026-11-22
  (`feat/plan-day-modal`): clicking a day opens its plan in a native
  `<dialog>` (full-screen below `sm`), with stops in order, each expandable to
  its recorded details, and next/previous day. The schema has no times, so a
  stop shows its duration and opening hours when recorded. Read model:
  `lib/itinerary/day-plan.ts`. After owner review: a navy header band with a
  trip summary (days, stops, areas, saved), richer day cards (number badge,
  stop preview, area chips), a navy dialog header, and Fraunces as the
  display face (also on the landing's headings). The day cards then became a
  scroll-snap carousel: 5/4/3 across at `xl`/`lg`/`md`, about 1.2 on phones
  (the phone rule is an assumption, not an owner call), arrows, ←/→ between
  cards, and a "Days 1–5 of 12" indicator. Paging days in the dialog scrolls
  the carousel to that day.
- **The Activity Bank** (wireframe Frame 1): a read-only dialog over every
  activity saved for the trip, with search that ignores accents. It brought the
  `activities.area` column (the neighbourhood), migration
  `drizzle/0009_ambiguous_the_anarchist.sql`, `lib/itinerary/bank.ts` and
  `components/planner/ActivityBank*.tsx`.
- **Docs.** `CLAUDE.md` is the single agent guide (`AGENTS.md` points to it),
  `docs/` holds only feature-work context, and `.github/pr-template.md` is
  the PR description format (PR #4).

## Email sign-in (branch `feat/email-otp-login`)

- **Sign in with an emailed 6-digit code**, alongside Google. `/login` takes
  the email, `/login/verify` takes the code. Both providers resolve to the same
  lower-cased email; neither adds anyone to `allowed_emails`.
- **Private: no new accounts.** A correct code for an address not on
  `allowed_emails` is refused with the same message as a wrong one, and no
  session is created. Allowed status is re-read on every request, so removing
  an address from `allowed_emails` sends that user to `/unauthorized` on their
  next request. There is still no way to *disable* a user who owns trips:
  deleting their `allowed_emails` row fails on the trips/activities FKs
  (fix C, a `disabled_at` column, was not taken).
- **Server-side sessions.** Every session JWT now carries an `auth_sessions`
  row id and is refused once that row is revoked or 30 days old. Sign-out is
  on `/plan`. Tokens issued before this have no row, so **everyone signs in
  once more** after it deploys.
- **Before deploying:** apply migration `drizzle/0010_email_otp_auth.sql`
  (`npm run db:migrate`, needs a yes — Neon is the only database), and set
  `RESEND_API_KEY` + `MAIL_FROM`; production refuses to send codes without
  them. Migration 0010 was applied to Neon on 2026-11-22; a browser sign-in
  against Neon is still untested.

## In this worktree

- Removed Notion page generation from the app, including its UI and API route.
  Existing records require no migration.

## In review

- **Standalone Activity Bank** at `/activity-bank`, linked from the Day Planner.
  It manages existing and new activities across the signed-in user's trips.
  Country and type labels use the existing activity metadata column, so the
  bank works with the current database schema, including databases that
  already have the email OTP migration.

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
     verify its search and empty state.
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
| **Rejection memory**: remember activities the user turned down so they aren't suggested again. | Open. | `CLAUDE.md` → Data model ("Nothing records rejection") |
| **Activity identity key**: the same real place regenerated becomes a second row. | Open. | [Activity identity key](#activity-identity-key) below |
| **Composite FK** so a placement can't pair a day and an activity from different trips. | Open. The data layer enforces it for now. | `CLAUDE.md` → Data model; `sql/validate-itinerary.sql` check 9 |

### Activity identity key

The same real-world place regenerated by the agent becomes a new `activities`
row with a new uuid, so a previously rejected place can be suggested again.
Fixing it needs an identity key on `activities` (a normalised name + address,
or the `source_metadata` provider id) plus a partial unique index. It does not
touch the itinerary tables.

## Loose ends

- No React component tests. Views are verified by browser only.
