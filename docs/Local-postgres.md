# Running a local Postgres (and `validate-itinerary.sql`)

Why bother when Neon exists: `sql/validate-itinerary.sql` is safe — it wraps
everything in `BEGIN … ROLLBACK` — but "safe" and "safe to be wrong about" are
different things. A local database is a **scratch pad you can set on fire**.
Break it, drop it, recreate it in twenty seconds. It also runs with no network
in the loop, which matters when you are iterating on a 250-line SQL script.

> **Scope warning, read this first.** A local Postgres is for **`psql` and
> `drizzle-kit` only**. The app itself will *not* run against it: `lib/db/client.ts`
> uses **`@neondatabase/serverless`**, an **HTTP driver** that speaks to Neon's
> API endpoint, not the Postgres **wire protocol**. Pointing `DATABASE_URL` at
> `localhost` and running `npm run dev` will fail. Keep Neon for the app; use
> local for schema work and SQL.

---

## 1. Get a Postgres running

Pick one. All three give you the same thing: a server on a port, and the `psql`
client. **Postgres 13 or newer** — the script uses `gen_random_uuid()`, which
moved into core in 13 (before that it needed the `pgcrypto` extension).

### Option A — Docker (recommended)

Most disposable, zero interaction with anything else on your Mac.

```bash
docker run --name travel-tao-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=travel_tao \
  -p 5433:5432 \
  -d postgres:17
```

**Port 5433 on purpose.** If you ever install Postgres another way it will grab
5432, and two servers fighting over one port produces confusing "connection
refused" errors. Mapping to 5433 sidesteps it permanently.

```bash
docker ps                      # running?
docker logs travel-tao-pg      # "database system is ready to accept connections"
docker stop travel-tao-pg      # stop, keeps data
docker start travel-tao-pg     # back
docker rm -f travel-tao-pg     # nuke it, data and all
```

You still need a client on the host — `brew install libpq` then add it to your
PATH, or just exec into the container:

```bash
docker exec -it travel-tao-pg psql -U postgres -d travel_tao
```

### Option B — Homebrew

```bash
brew install postgresql@17
brew services start postgresql@17
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
exec zsh
createdb travel_tao
```

Homebrew's Postgres creates a superuser named after your macOS account with no
password, so the connection string has no credentials in it. Fine locally,
surprising the first time.

### Option C — Postgres.app

Download from postgresapp.com, drag to Applications, click **Initialize**. Then
add the bundled binaries to your PATH:

```bash
echo 'export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"' >> ~/.zshrc
exec zsh
createdb travel_tao
```

Best option if you want a GUI toggle and no daemon management.

### Confirm it works

```bash
psql "postgresql://postgres:postgres@localhost:5433/travel_tao" -c "SELECT version();"
```

Substitute your own URL if you went with B or C — typically
`postgresql://$(whoami)@localhost:5432/travel_tao`.

---

## 2. Keep the connection string somewhere convenient

Add to `.env.local` **alongside** the Neon one — do not replace it:

```bash
# Neon — what the app actually uses
DATABASE_URL=postgresql://...neon.tech/...

# Local scratch — psql and drizzle-kit only
LOCAL_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/travel_tao
```

Then in your shell:

```bash
export LOCAL_DB="postgresql://postgres:postgres@localhost:5433/travel_tao"
psql "$LOCAL_DB"
```

Optionally set `PGDATABASE`, `PGHOST`, `PGPORT` and `PGUSER` instead — `psql`
reads those and you can then type a bare `psql`. Useful once, confusing later
when you forget they are set. The explicit URL is worth the extra typing.

---

## 3. Create the schema

The database is empty. Two routes, and they are genuinely different tools.

### Route 1 — `drizzle-kit push` (fast, recommended)

**`push`** diffs `lib/db/schema.ts` straight against the live database and
applies the difference. No migration files, no history. Exactly the five tables
the schema declares.

```bash
DATABASE_URL="$LOCAL_DB" npx drizzle-kit push
```

**Why the inline env var works:** `drizzle.config.ts` calls dotenv's
`config({ path: ".env.local" })`, and **dotenv does not overwrite a variable
that is already set**. So a value on the command line wins over the file. Your
Neon URL is untouched.

`CLAUDE.md` warns that `push` desynchronizes the migration snapshot — that is
about the **Neon** database, which has real migration history in
`__drizzle_migrations`. Pushing to a throwaway local database is fine, because
`drizzle-kit generate` diffs against the **snapshot JSON files in the repo**,
not against whatever database you last touched. Just never point `push` at Neon.

### Route 2 — replay the migration chain (slower, proves more)

Use this when you want to verify the migrations themselves still work end to
end — for example before handing the repo to someone else.

There is a wrinkle. **`drizzle/0000_young_shriek.sql` is a commented-out no-op
baseline.** Its ten tables were hand-built against Neon before the repo had
migrations, so the body sits inside a `/* … */` block. Against an empty
database, running the chain as-is produces `relation "trips" does not exist`,
because `0001` alters tables `0000` never created.

```bash
# 1. Temporarily uncomment the body of drizzle/0000_young_shriek.sql
#    (delete the /* on line ~12 and the */ near the end)

# 2. Apply everything
DATABASE_URL="$LOCAL_DB" npx drizzle-kit migrate

# 3. Put the comment markers back before committing anything
git checkout drizzle/0000_young_shriek.sql
```

This creates ten tables and then drops seven of them again (that is `0003`
doing its job), landing on the same five as Route 1.

> `db:migrate` **swallows errors and exits 1 silently.** If it prints no
> success line, replay the failing file through `psql` to see the real message:
> `psql "$LOCAL_DB" -f drizzle/0003_grey_tarot.sql`

### Verify either route

```bash
psql "$LOCAL_DB" -c "\dt"
```

Expect exactly five: `activities`, `allowed_emails`, `day_itineraries`,
`day_itinerary_activities`, `trips`.

---

## 4. Seed the allow-list — the script will not run without it

**This is the step that will bite you.** `validate-itinerary.sql` inserts trips
and activities for `victorli7462@gmail.com`, and both tables carry a **foreign
key** on `user_email` referencing `allowed_emails.email`. The script does not
seed that row, because on Neon it already exists.

On a fresh local database, setup dies immediately with:

```
ERROR: insert or update on table "trips" violates foreign key constraint
       "trips_user_email_fkey"
```

Fix it once, permanently:

```bash
psql "$LOCAL_DB" -c \
  "INSERT INTO allowed_emails (email) VALUES ('victorli7462@gmail.com')
   ON CONFLICT (email) DO NOTHING;"
```

`ON CONFLICT DO NOTHING` makes it **idempotent** — safe to paste again after
any rebuild. Worth putting in a `sql/seed-local.sql` so a rebuild is two
commands instead of two commands and a memory.

---

## 5. Run the validation script

```bash
psql "$LOCAL_DB" -f sql/validate-itinerary.sql
```

Against Neon, the header of the script itself gives the one-liner:

```bash
psql "$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')" \
  -f sql/validate-itinerary.sql
```

**Reading the output:** every check prints one row of
`check | expected | actual | result`. Checks 1–8 should print **PASS**. Check 9
prints **UNENFORCED** by design — it demonstrates the known gap where a
placement can pair a day from one trip with an activity from another. That is a
finding, not a regression.

The `BEFORE` and `AFTER` row counts at the top and bottom must match. They
will, because the whole body is inside `BEGIN … ROLLBACK`. If they ever differ,
something escaped the transaction and that is the bug worth chasing.

Note the script sets **`\set ON_ERROR_STOP on`**, so `psql` aborts on the first
error rather than ploughing on and cascading nonsense. Checks 4, 5 and 8
deliberately *cause* errors — they wrap them in **PL/pgSQL** `DO $$ … EXCEPTION`
blocks, because an uncaught constraint violation would abort the entire
transaction rather than just that statement.

---

## 6. Running raw SQL

### Interactive session

```bash
psql "$LOCAL_DB"
```

You get a `travel_tao=#` prompt. **Statements need a semicolon** — without one
`psql` just keeps waiting, and the prompt changes to `travel_tao-#` to tell you
so. The other classic hang is an unclosed quote (`'`) or paren.

The backslash commands are **`psql` meta-commands**, not SQL — they never reach
the server:

| Command | Does |
| --- | --- |
| `\dt` | list tables |
| `\d activities` | describe a table — columns, indexes, constraints, FKs |
| `\d+ activities` | same plus storage, comments |
| `\di` | list indexes |
| `\l` | list databases |
| `\dn` | list schemas |
| `\x` | toggle **expanded display** — rows print vertically |
| `\timing` | toggle query timing |
| `\e` | open the last query in `$EDITOR` |
| `\i sql/validate-itinerary.sql` | run a file from inside the session |
| `\copy (SELECT …) TO 'out.csv' CSV HEADER` | export, client-side |
| `\q` | quit |

**`\x` is the one to remember.** `activities` has fourteen columns; unexpanded
it wraps into unreadable mush. `\x auto` switches automatically based on width.

### One-off from the shell

```bash
psql "$LOCAL_DB" -c "SELECT name, priority_score FROM activities ORDER BY priority_score DESC NULLS LAST;"
```

`-c` runs one command and exits. Useful flags:

```bash
-f file.sql        # run a file
--csv              # CSV output
-t                 # tuples only — no headers, no row count
-A                 # unaligned — no column padding
-q                 # quiet
-v ON_ERROR_STOP=1 # abort on first error (do this in any script)
```

`-t -A` together give you bare values, which is what you want when piping into
another command:

```bash
psql "$LOCAL_DB" -t -A -c "SELECT count(*) FROM trips;"
```

### Heredoc for multi-statement work

```bash
psql "$LOCAL_DB" <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
  UPDATE activities SET priority_score = 5 WHERE name = 'Dotonbori';
  SELECT name, priority_score FROM activities WHERE name = 'Dotonbori';
ROLLBACK;
SQL
```

**Quote the heredoc delimiter** (`<<'SQL'`, not `<<SQL`) or the shell will
expand `$` and backticks inside your SQL before Postgres ever sees them — which
mangles every `DO $$ … $$` block.

### Variables, the way the validation script uses them

`psql` has its own variable system, and the script leans on it heavily:

```sql
\set trip_id '00000000-0000-0000-0000-000000000000'
SELECT * FROM trips WHERE id = :'trip_id';   -- :'x' interpolates as a quoted literal
```

**`\gset` is the interesting one** — it captures a query result into variables:

```sql
INSERT INTO trips (user_email, name) VALUES ('you@example.com', 'Test')
RETURNING id AS trip_id \gset

SELECT * FROM day_itineraries WHERE trip_id = :'trip_id';
```

Note there is **no semicolon** before `\gset` — it terminates the statement
itself. That trips everyone up once.

From the shell, `-v` sets them:

```bash
psql "$LOCAL_DB" -v email="'victorli7462@gmail.com'" \
  -c "SELECT count(*) FROM trips WHERE user_email = :email;"
```

These are **textual substitution**, not bind parameters. They are not injection
safe. Never build one from untrusted input — in app code use the driver's
parameterization instead.

### Drizzle Studio

```bash
DATABASE_URL="$LOCAL_DB" npx drizzle-kit studio
```

Opens a browser data explorer. Good for eyeballing rows and confirming a
migration did what you meant. Not a substitute for reading the SQL.

---

## 7. Suggested npm scripts

```jsonc
"db:local:push":     "cross-env DATABASE_URL=$LOCAL_DATABASE_URL drizzle-kit push",
"db:local:seed":     "psql \"$LOCAL_DATABASE_URL\" -f sql/seed-local.sql",
"db:local:validate": "psql \"$LOCAL_DATABASE_URL\" -f sql/validate-itinerary.sql",
"db:validate":       "psql \"$DATABASE_URL\" -f sql/validate-itinerary.sql"
```

npm does not read `.env.local`, so either `source` it first
(`set -a && source .env.local && set +a`) or add `dotenv-cli` and prefix with
`dotenv -e .env.local --`.

---

## 8. Rebuilding from scratch

The whole point of a local database — four commands, under a minute:

```bash
docker rm -f travel-tao-pg
docker run --name travel-tao-pg -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=travel_tao \
  -p 5433:5432 -d postgres:17
sleep 3
DATABASE_URL="$LOCAL_DB" npx drizzle-kit push
psql "$LOCAL_DB" -c "INSERT INTO allowed_emails (email) VALUES ('victorli7462@gmail.com') ON CONFLICT DO NOTHING;"
psql "$LOCAL_DB" -f sql/validate-itinerary.sql
```

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `connection refused` | Server not running, or wrong port. `docker ps`, or `brew services list`. |
| `role "postgres" does not exist` | Homebrew/Postgres.app installs — the superuser is your macOS username, not `postgres`. |
| `database "travel_tao" does not exist` | `createdb travel_tao`, or recreate the container with `POSTGRES_DB` set. |
| `violates foreign key constraint "trips_user_email_fkey"` | Section 4 — seed `allowed_emails`. |
| `relation "trips" does not exist` running migrations | `0000` is still commented out. Section 3, Route 2. |
| `function gen_random_uuid() does not exist` | Postgres 12 or older. Upgrade, or `CREATE EXTENSION pgcrypto;`. |
| Prompt stuck at `travel_tao-#` | Missing semicolon, or an unclosed quote. `Ctrl-C` to reset. |
| `db:migrate` exits 1 with no message | Known — it swallows errors. Replay the migration file through `psql`. |
| App fails against `localhost` | Expected. The Neon HTTP driver cannot speak to a local server. See the warning at the top. |
