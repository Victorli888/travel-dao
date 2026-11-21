# Working with Claude

> Owns: the ground rules for Claude sessions in this repo: what Claude may do
> alone, what it must ask about, and what it never does. Claude reads this
> because `CLAUDE.md` points here.

## Before writing code

- **Understand first.** Claude starts only when it's ~95% sure what's being
  asked. Otherwise it asks, with all the questions in one round. It doesn't
  ask what the code already answers.
- **Plan mode for anything beyond a small fix.** The plan names the files,
  reuses existing functions, and says how it will be verified. Approving a
  plan approves the code changes. It does **not** approve commits.
- **Read [status.md](status.md) first** when resuming, and check the open
  decisions the task depends on.
- **Stated assumptions.** When Claude proceeds on a guess, it says so in plain
  words. Unverified things are labelled unverified.

## Commits

**Claude commits only when asked.** Never as a side effect of finishing a
task, and never because a plan mentioned commits.

When asked, Claude proposes the stack (messages and which files go in each),
then commits.

**Format**: gitmoji + conventional commit, scoped:

```
✨ feat(itinerary): name a day

Body explains *why*, and what would go wrong otherwise.
Wrapped at ~72 columns.

Co-Authored-By: Claude <model> <noreply@anthropic.com>
```

| Emoji | Type | For |
| --- | --- | --- |
| ✨ | `feat` | New user-visible capability or new layer function |
| 🐛 | `fix` | Bug fix |
| ✅ | `test` | Tests only |
| ♻️ | `refactor` | Behaviour-preserving change |
| 📝 | `docs` | `CLAUDE.md`, `docs/`, README |
| ➕ / ➖ | `chore(deps)` | Adding or removing a dependency |
| 🗃️ | `feat(db)` / `chore(db)` | Schema + migration (shipped together) |
| 🙈 | `chore` | `.gitignore` and similar |

Scopes in use: `itinerary`, `planner`, `api`, `auth`, `ui`, `db`, `claude`.

**Shape of a stack.** Small commits, each building and passing tests, in
dependency order: deps → schema/types → data layer → tests → UI → docs.

**Mechanics:**
- Stage and commit as **separate** tool calls. The auto-mode classifier
  blocks them when batched.
- Never `--no-verify`, never `--amend` a pushed commit.
- `scratch/` is never committed.

## Always ask first

Claude asks, and waits for an explicit yes, before:

- `git push`, opening or merging a PR
- `git merge`, `git rebase`, `git revert`, `git cherry-pick`, anything with
  `--force` or `reset --hard`. (`revert` and `cherry-pick` are also blocked in
  settings; Claude hands over the command instead.)
- Deleting branches, or deleting or overwriting files it didn't create this
  session
- **`npm run db:migrate`, or any write to Neon.** Neon is the only database.
  There is no staging.
- Adding a dependency
- Changing a product call listed in [product.md](product.md)

A yes covers that one action, not the next one like it.

## Never

- Edit a migration that has already been applied. Add a new one instead.
- `drizzle-kit push`, or hand-written DDL against Neon.
- Add a `users` table or an `owner_id`. Ownership is the email.
- Add API routes for the planner.
- Use `db.transaction()` on neon-http, or a multi-statement write.
- Hardcode hex colours or mix the two palettes.
- Derive `area` from `address`, or reintroduce `activities.day_id`.
- Commit secrets or `.env*`.

## At the end of a task

- **Change report in the terminal, never in a file.** It lists:
  1. Files changed.
  2. Why each one changed, alongside its diff (`git diff`, plus contents
     of new files).
  3. Concerns, last.
  Changes Claude made on its own judgment get the same prominence as the ones
  asked for.
- **Report outcomes faithfully.** Failing tests are shown with output. Skipped
  steps are named.
- **Keep the docs current.** If the work taught us a new invariant, Claude
  proposes the `CLAUDE.md` addition. If a feature landed, it updates
  [status.md](status.md).

## Shared vocabulary

- **"Frame N"** is page N+1 of `scratch/Itinerary-Wireframes.pdf`. See
  [product.md](product.md#the-wireframes).
- **"The layer rule"**: `CLAUDE.md` → *Layers*.
- **"Step 0"** is the agent-persistence decision in
  [Itinerary-implementation-plan.md](Itinerary-implementation-plan.md).

## Where preferences go

| It's… | Put it in |
| --- | --- |
| A rule about the code | `CLAUDE.md` |
| A rule about process for anyone working here | This file or [development-workflow.md](development-workflow.md) |
| A personal preference about how Claude works with you | Claude memory |
