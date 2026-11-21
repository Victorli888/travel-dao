# Travel Tao docs

The reference point for how this app is built and how we work on it. Start
here after any break.

## Reading order

| # | Doc | Read it when |
| --- | --- | --- |
| 1 | [status.md](status.md) | First, every time you come back. Where the project is right now. |
| 2 | [product.md](product.md) | You need to know what a feature is *for*, or what a word means. |
| 3 | [architecture.md](architecture.md) | You're about to write code and need to know where it goes. |
| 4 | [development-workflow.md](development-workflow.md) | You're starting a new feature. The steps, and the Definition of Done. |
| 5 | [working-with-claude.md](working-with-claude.md) | Any session with Claude: commits, what needs asking, what's never allowed. |

## Deep dives

| Doc | What it is |
| --- | --- |
| [drizzle.md](drizzle.md) | The schema-change routine in this repo: generate → review → migrate. |

This folder holds only what's needed to build features here. Tutorials,
learning notes and superseded plans don't belong in it; git history has the
ones that used to be here.

## What lives where

| Place | Holds | Tracked in git? |
| --- | --- | --- |
| `CLAUDE.md` (repo root) | **The invariants**: data-model rules, the layer rule, styling tokens. Claude loads it every session. The source of truth when a doc here disagrees. | Yes |
| `AGENTS.md` (repo root) | A pointer to `CLAUDE.md` for agents that look for that filename. Holds no rules of its own. | Yes |
| `docs/` | Reference for both people and Claude: status, product intent, overview, process. Links to `CLAUDE.md` instead of restating rules. | Yes |
| `README.md` | Setup and the public-facing description. | Yes |
| `scratch/` | Private working files: wireframes PDF, DB backups, prompts, notes. | **No** |
| Claude memory (`~/.claude/projects/…/memory/`) | Personal working preferences (e.g. "ask before committing"). | No, it's per machine |

**One rule keeps these from drifting:** a rule lives in exactly one place. If
it constrains code, it goes in `CLAUDE.md`, and docs link to it. If it
describes process, it goes in `docs/`.
