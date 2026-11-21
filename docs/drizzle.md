# Drizzle in this repo

`lib/db/schema.ts` is the source of truth. The files in `drizzle/` are the history of how that schema got onto Neon. The app never reads those `.sql` files at runtime — only drizzle-kit does, when you migrate.

```
edit schema.ts  →  db:generate  →  review the SQL  →  db:migrate
```

Do not change Neon in the console and then hope `schema.ts` catches up. Do not edit a migration that has already been applied.

## Everyday change

1. Edit `lib/db/schema.ts` (add/drop a column, rename a table, change a type, …).
2. Batch until the decision is stable. Do not generate after every keystroke.
3. In a **real terminal** (so prompts work):

   ```bash
   npm run db:generate
   ```

   Kit diffs `schema.ts` against the latest `drizzle/meta/*_snapshot.json` and writes:

   - `drizzle/000N_something.sql` — the SQL that will run
   - `drizzle/meta/000N_snapshot.json` — schema photo after this step
   - an entry in `drizzle/meta/_journal.json`

4. Open the new `.sql` and read it. You want the intent you meant (see [Review](#review-the-sql)).
5. Apply it to Neon:

   ```bash
   npm run db:migrate
   ```

   Until this runs, Studio still shows the old shape.
6. Commit `schema.ts` **and** the new `000N` SQL **and** the new snapshot **and** `_journal.json` together.

Until step 5, only TypeScript has changed.

## Commands

| Script | What it does |
| --- | --- |
| `npm run db:generate` | Write a new migration from `schema.ts`. Does not touch Neon. |
| `npm run db:migrate` | Run pending `.sql` files against `DATABASE_URL`. |
| `npm run db:studio` | Browse the live database. |
| `npm run db:pull` | Introspect Neon into a schema dump. Reference only — do not treat pull output as the source of truth. |

`drizzle.config.ts` loads `.env.local` itself. Kit does not go through Next.js.

## Review the SQL

**Rename** (table or column): kit will ask “is this a rename?” Answer **yes**. You want `ALTER … RENAME`, not `DROP` + `CREATE` (that deletes rows). Generate must run in an interactive terminal; if it errors with “Interactive prompts require a TTY,” run it in your own shell, do not invent the SQL by hand unless you know you need `RENAME`.

**Type change** (e.g. `text` → `integer`): look for `USING`. Postgres will reject a bare `text` → `integer` alter. If kit omits `USING "col"::integer`, add it **before** migrate. If it drops the column and adds it back, existing values are gone.

**Drop table / column**: also drop every FK and column in `schema.ts` that pointed at it, or generate will fail or emit junk. `DROP` deletes data.

If generate is wrong and you have **not** migrated yet: delete the new `000N` SQL, its snapshot, and the journal entry, fix `schema.ts`, generate again. Never rewrite a file that already ran on Neon — add `000N+1` instead.

## What not to do

- Do not `db:push` against this database. This repo uses generate + migrate.
- Do not squash old `.sql` files to “clean up.” They are append-only history. Neon records what already ran in `__drizzle_migrations`.
- Do not edit `drizzle/0000_*.sql`. It is a commented baseline because those tables existed before migrations. Everything from `0001` onward is real.
- Do not “fix” `text_ops` / `uuid_ops` in `schema.ts` unless you intend a migration that rebuilds the index.

## `0000`

`drizzle/0000_*.sql` is a no-op: its body is commented out. It exists so kit has a snapshot to diff against. A **fresh** empty database needs that body uncommented first, then migrate. Against the current Neon database, leave it commented.

## Mental model

| File | Who writes it | Job |
| --- | --- | --- |
| `lib/db/schema.ts` | You | What the app thinks the database is |
| `drizzle/000N_*.sql` | drizzle-kit (you review) | How to get Postgres there |
| `drizzle/meta/` | drizzle-kit | Bookkeeping for the next generate |

A growing list of `000N` files is expected. Do not squash them.
