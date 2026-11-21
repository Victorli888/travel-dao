# Drizzle ORM Crash Course (TypeScript + Next.js 15 + Postgres)

Written against Postgres, since that's what both your apps run on. Everything here works the same on Neon and on RDS — only the driver changes.

---

## 1. The mental model

Coming from EF Core, the biggest adjustment is that Drizzle is **not** an ORM in the "objects with change tracking" sense. There's no `DbContext`, no identity map, no lazy loading, no `SaveChanges()`. It's a **typed SQL query builder** with a migration tool bolted on.

| EF Core | Drizzle |
|---|---|
| Entity classes + fluent config | `schema.ts` — tables declared as plain objects |
| `DbContext`, change tracking | none — every call is a statement you write |
| `SaveChanges()` batches work | each `insert/update/delete` fires immediately |
| LINQ → SQL translation | you write SQL shape directly, typed |
| Migrations from model diff | same idea: `drizzle-kit generate` diffs schema vs. snapshot |

Two consequences worth internalizing early:

1. **Your TypeScript schema file is the source of truth.** Types are inferred from it, not generated into a separate file like Prisma does. No codegen step to keep in sync.
2. **If you know the SQL you want, the Drizzle code is nearly a transliteration.** When you're stuck, write the SQL first, then translate.

---

## 2. Install and wire it up

```bash
npm i drizzle-orm pg
npm i -D drizzle-kit @types/pg
```

`pg` (node-postgres) is the right driver for **RDS** and for any long-lived Node process. If you're still on Neon serverless, use `@neondatabase/serverless` instead — see §11.

### `src/db/index.ts`

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

export const db = drizzle(pool, { schema });
```

Passing `{ schema }` is what unlocks the relational query API (`db.query.*`) in §9. Without it you still get the SQL builder, just not the nested-fetch helper.

### `drizzle.config.ts` (project root)

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
```

If `DATABASE_URL` lives in `.env.local` (Next.js convention), drizzle-kit won't read it automatically. Either add `import 'dotenv/config'` at the top of the config with a `path` option, or run commands as `dotenv -e .env.local -- npx drizzle-kit generate`.

---

## 3. Defining a schema

```ts
// src/db/schema.ts
import {
  pgTable, uuid, text, integer, numeric, boolean, timestamp,
  pgEnum, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const auctionStatus = pgEnum('auction_status', [
  'draft', 'live', 'ended', 'cancelled',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  vin: text('vin').notNull().unique(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
});

export const auctions = pgTable('auctions', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id),
  status: auctionStatus('status').notNull().default('draft'),
  reservePrice: numeric('reserve_price', { precision: 12, scale: 2 }),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('auctions_status_ends_at_idx').on(t.status, t.endsAt),
]);

export const bids = pgTable('bids', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id').notNull().references(() => auctions.id, { onDelete: 'cascade' }),
  bidderId: uuid('bidder_id').notNull().references(() => users.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('bids_auction_amount_idx').on(t.auctionId, t.amount),
]);
```

Notes that will save you time:

- The first string argument is the **database** column name; the object key is the **TypeScript** name. Snake case in the DB, camel case in code, no mapper needed.
- `numeric` comes back as a **string** in JS, because Postgres numerics don't fit in a float64. That's correct behavior for money — don't "fix" it by switching to `real`. Parse at the edges, or store cents in a `bigint`/`integer`.
- The third argument (indexes, composite PKs, checks) is a callback. Newer drizzle-kit expects it to return an **array**; older versions expected an object. If you hit a type error there, that's which version you're on.
- `.references()` creates a real FK constraint. It does **not** by itself enable `db.query` joins — that's `relations()`, next.

### Relations (for the query API only)

```ts
export const usersRelations = relations(users, ({ many }) => ({
  vehicles: many(vehicles),
  bids: many(bids),
}));

export const auctionsRelations = relations(auctions, ({ one, many }) => ({
  vehicle: one(vehicles, { fields: [auctions.vehicleId], references: [vehicles.id] }),
  bids: many(bids),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  auction: one(auctions, { fields: [bids.auctionId], references: [auctions.id] }),
  bidder: one(users, { fields: [bids.bidderId], references: [users.id] }),
}));
```

This is metadata for Drizzle, not DDL. It changes nothing in the database.

> Version note: Drizzle has been rolling out a "relations v2" API (`defineRelations`) with a different shape from the `relations()` helper above. Check which one your installed version documents before you copy this wholesale — the rest of the course is unaffected.

---

## 4. Types come free

```ts
export type User = typeof users.$inferSelect;      // row shape read out
export type NewUser = typeof users.$inferInsert;   // insert shape (defaults optional)
```

`NewUser` correctly marks `id` and `createdAt` as optional because they have defaults, and `email` as required. This is the single best ergonomic win over hand-rolled SQL: your DTOs stop drifting from your tables.

---

## 5. Migrations

Two workflows. Use both, at different times.

**Prototyping — push:**
```bash
npx drizzle-kit push
```
Diffs your schema against the live DB and applies changes directly. No migration files. Great on a scratch database while you're still deciding on columns. Never point it at production.

**Real work — generate + migrate:**
```bash
npx drizzle-kit generate   # writes ./drizzle/0001_xxx.sql + snapshot
npx drizzle-kit migrate    # applies pending files, tracks them in __drizzle_migrations
```

Always open the generated `.sql` before applying. drizzle-kit can't infer intent: renaming a column looks identical to "drop one, add another," and it will prompt you. Editing the generated SQL by hand is normal and expected — for example, adding a `NOT NULL` column to a populated table needs a backfill statement inserted between the `ADD COLUMN` and the `SET NOT NULL`.

`npx drizzle-kit studio` gives you a browser data explorer. Handy while learning.

For your AWS migration specifically: run `migrate` as a deploy step (a script or task), not at app boot. Multiple EC2 instances booting at once will race on the migration table.

---

## 6. Reading data

```ts
import { eq, and, or, gt, gte, lt, desc, asc, ilike, inArray, isNull, sql, count } from 'drizzle-orm';
import { db } from '@/db';
import { auctions, bids, vehicles } from '@/db/schema';

// everything
const all = await db.select().from(auctions);

// specific columns — return type narrows automatically
const summaries = await db
  .select({ id: auctions.id, endsAt: auctions.endsAt })
  .from(auctions);

// filtered, sorted, paged
const live = await db
  .select()
  .from(auctions)
  .where(and(eq(auctions.status, 'live'), gt(auctions.endsAt, new Date())))
  .orderBy(asc(auctions.endsAt))
  .limit(20)
  .offset(0);

// single row
const [auction] = await db.select().from(auctions).where(eq(auctions.id, id)).limit(1);
if (!auction) notFound();
```

There is no `.findFirst()` on the SQL builder — `select()` always returns an array. Destructure, and always handle the empty case.

**Composing filters conditionally:**

```ts
const filters = [eq(auctions.status, 'live')];
if (make) filters.push(ilike(vehicles.make, `%${make}%`));
if (maxYear) filters.push(lte(vehicles.year, maxYear));

const rows = await db.select().from(auctions)
  .innerJoin(vehicles, eq(auctions.vehicleId, vehicles.id))
  .where(and(...filters));
```

`and()` ignores `undefined` entries, so `and(a, cond ? b : undefined)` also works.

**Joins return namespaced objects:**

```ts
const rows = await db
  .select()
  .from(bids)
  .innerJoin(auctions, eq(bids.auctionId, auctions.id));
// rows[0] === { bids: {...}, auctions: {...} }
```

Left joins make the right side `T | null` in the type, which is correct and will force you to handle it.

**Aggregates:**

```ts
const [{ highest }] = await db
  .select({ highest: sql<string>`max(${bids.amount})` })
  .from(bids)
  .where(eq(bids.auctionId, auctionId));

const perAuction = await db
  .select({ auctionId: bids.auctionId, n: count() })
  .from(bids)
  .groupBy(bids.auctionId)
  .having(gt(count(), 5));
```

`sql<T>` is your escape hatch for anything the builder doesn't cover. The generic is an **assertion** — Drizzle can't verify it, so if you write `sql<number>` around a `max(numeric)` you'll get a string at runtime and a lying type. Interpolating a column with `${}` is parameterized and safe; interpolating raw user input is not — use `sql.placeholder` or pass values as parameters.

---

## 7. Writing data

```ts
// insert + get the row back
const [user] = await db.insert(users)
  .values({ email, displayName })
  .returning();

// bulk
await db.insert(bids).values([{...}, {...}]);

// upsert
await db.insert(users)
  .values({ email, displayName })
  .onConflictDoUpdate({ target: users.email, set: { displayName } });

// update
const [updated] = await db.update(auctions)
  .set({ status: 'ended' })
  .where(eq(auctions.id, id))
  .returning();

// delete
await db.delete(bids).where(eq(bids.auctionId, id));
```

`.returning()` is Postgres `RETURNING` — free, and it saves you the follow-up select. Without a `.where()`, update and delete hit every row. There is no guardrail. Write the `where` first, then go back and fill in the `set`.

---

## 8. Transactions and locking

```ts
await db.transaction(async (tx) => {
  const [auction] = await tx
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .for('update');            // SELECT ... FOR UPDATE

  if (!auction || auction.status !== 'live' || auction.endsAt < new Date()) {
    tx.rollback();             // throws; unwinds the transaction
  }

  const [top] = await tx.select({ amount: bids.amount }).from(bids)
    .where(eq(bids.auctionId, auctionId))
    .orderBy(desc(bids.amount)).limit(1);

  if (top && Number(amount) <= Number(top.amount)) {
    throw new Error('Bid too low');
  }

  await tx.insert(bids).values({ auctionId, bidderId, amount });
});
```

Use `tx` inside the callback, never the outer `db` — a stray `db` call runs on a different connection outside the transaction and silently breaks your atomicity. Any thrown error rolls back automatically.

Isolation levels: `db.transaction(fn, { isolationLevel: 'serializable' })`. For the auction bid path, `FOR UPDATE` on the auction row (pessimistic) is simpler to reason about than serializable + retry loop, and it's the same tradeoff you've looked at before.

---

## 9. The relational query API

When you want a nested object graph rather than a flat join, and you passed `{ schema }` to `drizzle()`:

```ts
const auction = await db.query.auctions.findFirst({
  where: (a, { eq }) => eq(a.id, id),
  with: {
    vehicle: true,
    bids: {
      orderBy: (b, { desc }) => desc(b.amount),
      limit: 10,
      with: { bidder: { columns: { id: true, displayName: true } } },
    },
  },
});
// auction.bids[0].bidder.displayName — typed all the way down
```

`findMany` / `findFirst` also take `columns`, `extras`, `limit`, `offset`. Drizzle compiles this to **one** query (using lateral joins / json aggregation), so there's no N+1 — but it's also less flexible than the SQL builder. Rule of thumb: `db.query` for read endpoints that return a document-shaped payload, `db.select` for anything with aggregation, unusual joins, or a hot path you want to hand-tune.

---

## 10. Validation with drizzle-zod

```bash
npm i drizzle-zod zod
```

```ts
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const newBidSchema = createInsertSchema(bids, {
  amount: z.string().regex(/^\d+(\.\d{1,2})$/),
}).pick({ auctionId: true, amount: true });
```

One schema definition drives the table, the TS types, and the runtime validation on your server actions. This is the payoff of schema-as-code.

---

## 11. Next.js 15 specifics

**Connection singleton.** Dev HMR re-evaluates modules and will open a new pool on every save until you exhaust `max_connections`:

```ts
const globalForDb = globalThis as unknown as { pool?: Pool };
const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL! });
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;
export const db = drizzle(pool, { schema });
```

**Server-only.** Add `import 'server-only'` to `src/db/index.ts`. If a client component ever imports something that transitively pulls in your db module, you want a build error, not a bundled connection string.

**Server actions:**

```ts
'use server';
export async function placeBid(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  const parsed = newBidSchema.parse(Object.fromEntries(formData));
  await db.transaction(async (tx) => { /* ... */ });
  revalidatePath(`/auctions/${parsed.auctionId}`);
}
```

Authorize in the action, not in the query layer. Drizzle has no row-level security concept of its own; a `where` clause you forgot is a data leak.

**Caching.** Drizzle calls are just async functions, so Next.js caching rules apply normally: dynamic by default in Next 15, `unstable_cache` or `cacheTag` if you want to memoize a read, `revalidatePath`/`revalidateTag` after writes.

**Driver by environment:**
- **RDS on EC2** — `node-postgres` + `Pool` as above. Long-lived process, pooling works properly.
- **Neon serverless / Vercel functions** — `drizzle-orm/neon-http` + `@neondatabase/serverless`. HTTP-based, no connection to hold open. Note: the HTTP driver doesn't support interactive transactions; use `neon-serverless` (WebSocket) if you need `db.transaction`.
- **Lambda/serverless against RDS** — you need RDS Proxy or pgbouncer, or you'll blow through connection limits. This is the main thing that'll bite you in your migration.

**Prepared statements** (worth it on a hot path in a long-lived process, pointless in serverless):

```ts
const byId = db.select().from(auctions)
  .where(eq(auctions.id, sql.placeholder('id')))
  .prepare('auction_by_id');

const rows = await byId.execute({ id });
```

---

## 12. Gotchas worth pre-loading

- **No change tracking.** Mutating a returned object does nothing. Call `update()`.
- **`numeric` is a string.** Never `+` two of them. Wrap money in a small value type or store integer cents.
- **`timestamp` without `withTimezone: true`** maps to `timestamp` (no tz) and will quietly drift. Use `{ withTimezone: true }` on anything real.
- **`push` and `generate` are different worlds.** Using `push` on a database that has migration history desynchronizes the snapshot. Pick one per environment.
- **Column renames** need the interactive prompt from `generate`, or you lose data. Read the SQL.
- **Debugging:** `db.select()...toSQL()` returns `{ sql, params }`. Or `drizzle(pool, { schema, logger: true })` to log every statement. Do this early and often while you're learning — it makes the builder→SQL mapping click fast.
- **Enums:** adding a value to a `pgEnum` generates `ALTER TYPE ... ADD VALUE`, which can't run inside a transaction block in older Postgres. Occasionally needs a hand-edited migration.

---

## 13. A learning path with your own app

Since the vehicle auction app is already your running example, the fastest way through this is to rebuild its data layer:

1. Write `schema.ts` for users / vehicles / auctions / bids. Run `push` against a scratch DB, open `studio`, confirm the tables look right.
2. Switch to `generate` + `migrate`. Make one deliberate breaking change (add a `NOT NULL` column to a populated table) and hand-edit the migration to backfill.
3. Build the auction list query: filters, join to vehicles, pagination, sorted by ending soonest. Log the SQL and read it.
4. Build the auction detail page with `db.query.findFirst` + nested bids. Compare the emitted SQL to what you'd have written by hand.
5. Build `placeBid` as a transaction with `FOR UPDATE`. Then write a test that fires two concurrent bids and prove exactly one wins.
6. Add a "highest bid per auction" aggregate with `groupBy`, and reach for `sql<T>` at least once so the escape hatch stops feeling scary.

Step 5 is the one that'll teach you the most, and it's the one that's actually hard.

---

## 14. Where to check when this goes stale

Drizzle moves fast and my knowledge has a cutoff — particularly around the relations API, drizzle-kit CLI flags, and the config schema. `orm.drizzle.team/docs` is the reference; when a snippet here doesn't typecheck, the version difference is almost always in `drizzle.config.ts` or the third argument of `pgTable`.
