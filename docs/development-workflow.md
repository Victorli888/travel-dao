# Development workflow

> Owns: the order of steps for building a feature, and what "done" means.
> Does not own: code rules (`CLAUDE.md`) or Claude-specific rules
> ([working-with-claude.md](working-with-claude.md)).

## The steps

### 1. Know what you're building
- Start from a wireframe frame ([product.md](product.md)) or a one-paragraph
  description of the user-visible outcome.
- Check [status.md](status.md) for open decisions it depends on. Decide those
  first. Don't build around them.
- With Claude: brainstorm, then **plan mode**. Nothing is written until the
  plan is approved.

### 2. Branch
- One feature per branch: `feat/<area>`, `fix/<area>`, `refactor/<area>`,
  `docs/<area>`, off `main`.
- Today `feat/itinerary-planning` is a long-running branch. Once it merges,
  new planner work should get its own smaller branches.
- Merge to `main` through a PR.

### 3. Schema first, if the feature needs data
1. Edit `lib/db/schema.ts`. Add a doc comment saying what NULL means.
2. `npm run db:generate`, in a real terminal, since it may prompt about
   renames.
3. **Read the emitted SQL.** Look for drop-and-recreate where you meant a
   rename, and a missing `USING` on type changes. See [drizzle.md](drizzle.md).
4. `npm run db:migrate`. It fails silently. If no success line prints, replay
   the SQL with `psql` to see the error.
5. These four ship in the same commit: `schema.ts`, the new
   `drizzle/000N_*.sql`, `drizzle/meta/000N_snapshot.json`, and
   `drizzle/meta/_journal.json`.

Never edit an applied migration (add `000N+1` instead), never `db:push`, and
never hand-write DDL against Neon.

### 4. Data layer
In `lib/itinerary/<entity>.ts`, following `CLAUDE.md` → *Data model*:
- `userEmail` is the first parameter, and ownership is checked in the SQL.
- One statement per write. A read before the write is fine.
- New inputs get a zod schema in `schemas.ts`, with caps that mirror the
  column `CHECK`s.
- Postgres errors are translated through `pg-errors.ts` into `AppError`s.

**Tests go in with it:**
- Pure logic gets a `*.test.ts` next to the file. These always run.
- DB behaviour goes in `crud.test.ts`, run live with
  `TEST_DATABASE_URL="$DATABASE_URL" npm test`. It only touches the test
  emails and cleans up after itself.
- Invariants the database should hold go in `sql/validate-itinerary.sql`
  (extend it, don't replace it).

### 5. Transport
- To read: the page's Server Component calls `lib/itinerary/` after
  `requireUserEmail()`.
- To write: a Server Action in `app/plan/actions.ts`.
- **No new API routes for the planner.**

### 6. UI
- Container (draft state and refs only) plus a pure `*View` in
  `components/planner/`.
- Shape domain data on the server or in a pure `lib/` module, never in the
  view.
- Light-palette tokens only, no hex values. `ember` at most once per page.
  Freestanding rules use `.rule-fade`.

### 7. Verify
Run these and read the output. Don't assume.

```bash
npm test          # unit tests
npm run lint
npm run build     # also typechecks
```

Then exercise the real flow in a browser (`npm run dev`), signed in, including
the empty state and the error state.

### 8. Write it down
- A new invariant or gotcha goes in `CLAUDE.md`, in the section it belongs to.
- Progress goes in [status.md](status.md): move the item to Done, and update
  Next and the open decisions.
- A non-obvious design choice gets a paragraph in the relevant `docs/`
  deep dive.

### 9. Commit and PR
- A small stack of commits in dependency order. See
  [working-with-claude.md](working-with-claude.md#commits) for the format.
- Push and open a PR to `main`. The PR description follows
  [`.github/pr-template.md`](../.github/pr-template.md): fill every section,
  and write "N/A" in one that doesn't apply rather than deleting it. Pass it
  with `gh pr create --body-file`, since GitHub only applies a template
  automatically when it's named `pull_request_template.md`.

---

## Definition of Done

A feature is done when every box is true:

- [ ] It does the user-visible thing from step 1, checked in a browser.
- [ ] `npm test`, `npm run lint` and `npm run build` pass.
- [ ] New pure logic has tests. New DB behaviour is covered in `crud.test.ts`.
- [ ] Any schema change has its migration reviewed, applied to Neon, and
      committed with its snapshot and journal.
- [ ] Every new query filters by `userEmail`. Every new write is one statement.
- [ ] No new API route for the planner. No hex values. Layer rule respected.
- [ ] `CLAUDE.md` and `docs/status.md` updated.
- [ ] Committed as a reviewable stack on a feature branch.
