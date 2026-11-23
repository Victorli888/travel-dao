# Dao 道

A personal travel planner. Name a trip, set its dates, and plan it day by day
at `/plan`. Keep every activity saved for the trip in its Activity Bank.
Planner data lives in Neon Postgres.

`/` is a landing page that introduces the planner.

---

## Current features

**Day Planner** *(in progress: see `docs/status.md`)*
- Create a trip from a name and two dates, or reopen one you started.
- Each trip gets one column per calendar day, generated the first time you open
  it. A day can be given a name; without one it shows its date.
- The Activity Bank is a read-only dialog over every activity saved for the
  trip, with search that ignores accents.
- Not built yet: adding an activity from the UI, placing one on a day, and
  reordering a day. The data layer for all three exists in `lib/itinerary/`.
  Until the UI does, the Activity Bank is empty.

**Access control**
- Google OAuth via Auth.js. Middleware allows public access to `/`, `/login`,
  `/unauthorized`, and `/api/auth`.
- Sign-in alone is not enough — the email must appear in an `allowed_emails`
  table. Anyone else lands on `/unauthorized` with a request-access link.

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 15.5 (App Router), React 19.2 |
| Language | TypeScript 5.9 (strict) |
| Styling | Tailwind CSS 4.2 — no config file; tokens live in an `@theme` block in `app/globals.css` |
| Auth | Auth.js / next-auth 5.0.0-beta.31, Google provider |
| Database | Neon serverless Postgres (`@neondatabase/serverless` 1.1), Drizzle ORM 0.45 + drizzle-kit 0.31 |
| Validation | zod 4.4 (planner input and environment) |
| Tests | Vitest 3.2, node environment |

---

## Running it

### Prerequisites

- Node.js 20 or newer (developed on 23.11).
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
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |

`lib/api/env.ts` validates `DATABASE_URL` with zod when database access first
needs it. Auth.js reads the `AUTH_*` variables directly.

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

Sign in at `/login` with an allow-listed Google account. Plan a trip at `/plan`.

---

## How it works

**Day Planner.** `/plan` and `/plan/[tripId]` are Server Components that call
`lib/itinerary/` directly, and writes are Server Actions; the planner has no API
routes. Every write is a single SQL statement, because the Neon HTTP driver has
no interactive transactions. `CLAUDE.md` → *Data model* has the rules.

---

## Pending features

Nothing here is scheduled — this is the parking lot.

**Known gaps**
- [ ] React views have no automated component tests.
- [ ] `git merge` / `git rebase` are unguarded relative to the commit policy in
      `docs/working-with-claude.md`.

**Ideas**
- [ ] Self-serve access requests rather than a mailto link.

---

## Reference

- `docs/README.md` — the project docs index: status, product, architecture,
  development workflow, and the ground rules for working with Claude.
- `CLAUDE.md` — architecture guidance for working in this repo.
