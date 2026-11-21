# Why `lib/itinerary/` is written the way it is

Notes on the reasoning behind each file, written for someone learning the
patterns rather than someone maintaining the code. The code says *what*; this
says *why*, and — more usefully — what the alternative was and why it lost.

Read `CLAUDE.md` first for the invariants themselves. This document assumes
them and explains the design decisions built on top.

---

## The ideas that cut across every file

Five decisions shaped everything else. If you remember nothing else, remember
these.

### 1. An invariant belongs in exactly one place

Every rule in this layer — the double LEFT JOIN, `NULLS LAST` on priority,
the unassigned split — is written once. Not because repetition is
ugly, but because a rule written three times is a rule that will be *wrong* in
one of them, and the wrong one will be the one nobody tests.

This is the entire justification for the layer existing. Without it, a route
handler writes Drizzle calls inline, then the next route writes them again
slightly differently, and six months later empty days silently disappear from
one screen and not another.

### 2. Separate the pure from the impure

`shape.ts` and `schemas.ts` touch no database. That is not an accident of how
they turned out — it is the point. Pure functions can be tested exhaustively
in milliseconds with no infrastructure, so the logic most likely to be subtly
wrong is the logic that is cheapest to pin down.

The general move: when a function does I/O *and* thinks, split the thinking
out. What remains does I/O and calls the thinker.

### 3. Fail closed on ownership

`userEmail` is the first parameter of every function and is always in the
`WHERE`. Drizzle has no row-level security. Ownership here is an email string
rather than a session-bound id, which makes it unusually easy to forget.

The rule is *authorize in the action, filter in the query, both*. Belt and
braces, because the failure mode is showing one user another user's data.

### 4. Don't lie in types

If a value is a `string` at runtime, its type says `string`. This sounds
obvious and is violated constantly — see the `db.execute` note in
`placements.ts` below, which cost an extra database round trip to honour.

A type that lies is worse than no type, because you stop checking.

### 5. Destructive things are explicit

Nothing in this layer deletes data as a side effect of something else.
Shortening a trip does not remove the days that fall outside the new range.
The user asked to change a date; they did not ask to throw away three days of
planning, and a typo should not be able to.

---

## `types.ts`

**Derive types from the schema; never hand-write them.**

```ts
export type TripRow = typeof trips.$inferSelect;
```

A hand-written `interface Trip` is a second source of truth that starts
correct and drifts. `$inferSelect` cannot drift: add a column and the type
gains it, so anything that needed updating fails to compile immediately.

**Separate the row from the DTO, but only where there is a real reason.**

There is exactly one divergence here:

```ts
export type Activity = Omit<ActivityRow, "lat" | "lng"> & {
  lat: number | null;
  lng: number | null;
};
```

`lat`/`lng` are `numeric(9,6)`, which Postgres sends as *text* because a
numeric does not fit in a float64. That is correct behaviour, not a bug to fix
by switching to `real` — but it means `activity.lat + 1` silently produces
`"35.6291"` instead of `36.629`. So the DTO parses them, and every other field
passes through untouched.

The lesson is the restraint. It is tempting to build a full DTO layer that
renames and reshapes everything "for flexibility". That is a translation cost
on every field forever, paid for a flexibility you will not use.

**Why no `import "server-only"` here.**

Types are erased at compile time. There is nothing in this file at runtime, so
there is nothing to leak. Knowing *why* a rule exists is what tells you where
it does not apply — applying it here would be cargo cult, and would break the
pure tests for no benefit.

---

## `schemas.ts`

**Validate at the boundary so a bad input is a 400, not a 500.**

Without this layer, `priorityScore: 9` reaches Postgres, violates
`activities_priority_score_check`, and surfaces as a 500 carrying a raw
constraint-violation message. With it, the caller gets 400 and "The highest
priority is 5."

The schemas deliberately *restate* constraints the database already enforces.
That duplication is the price of good error messages, and `schemas.test.ts`
exists specifically to stop the two copies drifting.

**Why hand-written rather than `drizzle-zod`.**

`createInsertSchema(activities)` would generate a schema from the table — and
it would be wrong, because **the request shape is narrower than the insert
shape**. The insert has `id` and `user_email`; the request must have neither.
`user_email` comes from the session and never from the client. A generated
schema that accepts it is a privilege-escalation bug wearing a convenience
feature's clothes.

This generalises: codegen from your storage layer to your API boundary tends
to leak exactly the fields you most want to keep out.

**The absent-versus-null distinction.**

```ts
if ("priorityScore" in patch) set.priorityScore = patch.priorityScore ?? null;
```

For a partial update, three states matter: *don't touch it*, *set it to a
value*, *clear it*. JavaScript gives you `undefined` and `null`, and it is
easy to collapse them by accident — `patch.priorityScore ?? current` treats
"clear this" as "leave it alone", and the user's edit silently does nothing.

Zod v4 omits absent optional keys from its output, so `in` distinguishes them
reliably. Worth verifying rather than assuming; I checked this behaviour
before relying on it.

**`safeParse`, first issue wins, always throw an `AppError`.**

```ts
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? ...);
  return parsed.data;
}
```

One function, so every entry point behaves identically. Because it throws a
typed error that already knows it is a 400, no caller anywhere ever branches
on a status code. That is the payoff of `lib/api/errors.ts`: status lives with
the error, not in a `switch` in every route.

Showing only the first issue is a deliberate product call — a wall of
validation errors is worse than the one that matters.

---

## `shape.ts`

**The most instructive file in the layer, because it exists purely to be
testable.**

Postgres answers a join in flat rows; React wants a tree. That translation is
where invariants die quietly, so it lives in a file with no database import,
no `server-only` marker, and no I/O — which means `shape.test.ts` runs in
three milliseconds with no infrastructure at all.

**The empty day is the whole point.**

```ts
if (row.activity) {
  day.activities.push(...);
}
```

The day is added to the map *before* this check. A row with a null activity
therefore contributes an empty day rather than nothing. Get this wrong and
every day with nothing planned vanishes from the UI — which a user reads as
data loss, not as a bug, and which no type error will ever catch.

This is why the fixture in the test carries an empty day and an unassigned
activity.
They are precisely the two cases an `INNER JOIN` would have eaten, so they are
precisely the two cases worth encoding in a test.

**Sorting in JavaScript even though the SQL already sorts.**

Deliberate. The query orders by `position asc nulls last`, and `groupDays`
sorts again. That looks like duplication to delete, but it is not: it makes
the function correct *on its own terms*, so its tests test the function rather
than testing my memory of what the query does. If someone later changes the
`ORDER BY`, the shaping still behaves.

Cheap redundancy that makes a unit genuinely independent is usually worth it.

**`NULL` is not zero.**

```ts
if (a.position === null) return 1;   // nulls last
```

`position` NULL means *unordered*, not *first*. `priorityScore` NULL means
*not yet rated*, not *lowest*. Both would sort catastrophically wrong under
the natural `a - b` with a `?? 0`, and both would look fine in a demo where
every row happens to have a value.

Whenever you meet a nullable column, ask what NULL *means* before deciding how
it sorts.

---

## `pg-errors.ts`

**Classify by error code, never by matching text.**

```ts
switch (sqlState(error)) {
  case UNIQUE_VIOLATION: throw new ConflictError(...);
```

`error.message.includes("duplicate key")` works until Postgres is upgraded, or
the server locale changes, or the constraint is renamed. SQLSTATE `23505` is a
documented contract. The same rule applies at every boundary in this codebase
— `lib/mcp/notion-client.ts` classifies credential failures the same way.

**Rethrow what you don't recognise.**

```ts
default: throw error;
```

The tempting alternative is a catch-all that turns every database error into a
400. That is a lie: a connection failure is not the user's fault, and dressing
it as one means you will spend an afternoon debugging a "validation error"
that was actually a dead database.

Translate what you understand. Let everything else through as the 500 it is.

**Pass `AppError` through untouched.**

An error that already knows its status has already been classified. Re-wrapping
it would discard that.

---

## `trips.ts`

**`userEmail` first, always in the `WHERE`.**

```ts
.where(and(eq(trips.id, id), eq(trips.userEmail, userEmail)))
```

Never `getTrip(id)` with a check afterwards. The filter is *in* the query, so
there is no version of this function that can return someone else's trip.

**"Not found" and "not yours" are the same error, deliberately.**

If a trip you don't own returned 403 while a nonexistent one returned 404, an
attacker could enumerate which trip ids are real. Both are `NotFoundError`.
This costs a little debuggability and is worth it.

**The one read-before-write, and why it is justified.**

`updateTrip` reads the trip before updating it, which no other write does. The
reason is that patching `endDate` alone can invert the range against a
`startDate` the patch never mentions, and no CHECK constraint exists to catch
it.

The distinction that makes this acceptable: *a read before a write is not a
partial write*. If the read succeeds and the write fails, nothing happened. If
two writes are needed and the second fails, you have corruption. The rule this
layer follows is "one write statement", not "one statement".

**`updatedAt` is set by hand.**

```ts
const set: PgUpdateSetSource<typeof trips> = { updatedAt: new Date() };
```

Because `trips.updatedAt` has no `$onUpdate` in the schema. Worth reading the
column definition rather than assuming the ORM handles it — a silently stale
`updated_at` is the kind of bug nobody notices for a year.

---

## `days.ts`

**Both joins are LEFT, and this is the highest-stakes line in the layer.**

```ts
.leftJoin(dayItineraryActivities, eq(...))
.leftJoin(activities, eq(...))
```

One so a day with nothing planned survives; one so the row survives when the
placement is absent. An `INNER JOIN` here compiles, typechecks, passes a
casual manual test on a populated trip, and silently drops every empty day.

**Generation is an upsert, not a read-then-write.**

```ts
.values(dates.map((date) => ({ tripId: trip.id, date })))
.onConflictDoNothing({ target: [dayItineraries.tripId, dayItineraries.date] })
```

The naive version reads existing days, diffs them in JavaScript, and inserts
the difference. That is two statements with a race between them, and on a
driver with no interactive transactions a failure between them leaves a trip
with four days and no error anywhere.

`UNIQUE (trip_id, date)` already makes "one row per calendar day" a database
invariant, so the upsert is *free* — the constraint does the diffing. Whenever
a unique constraint exists, look for the read-then-write you can delete.

**Enumerate dates in UTC.**

```ts
const cursor = new Date(`${start}T00:00:00Z`);
cursor.setUTCDate(cursor.getUTCDate() + 1);
```

A `date` column has no time zone. Stepping in local time crosses a DST
boundary twice a year and produces a duplicated or missing day — a bug that
appears for two weeks in spring, in one hemisphere.

**It only ever adds.**

`generateDays` never deletes. Shortening a trip leaves out-of-range days and
everything planned on them alone; removing one is `removeDay`, which the user
invokes deliberately. The UI can offer "3 days are now outside your trip
dates — remove them?" and the data survives a mistyped date either way.

**A sanity bound on the range.**

```ts
if (dates.length > MAX_TRIP_DAYS) throw new ValidationError(...);
```

Typing `2027` as `2077` should produce a friendly error, not eighteen thousand
rows. Cheap guards on user-supplied ranges are almost always worth it.

---

## `activities.ts`

**Ownership via the denormalised column, not a join.**

`activities.user_email` duplicates information reachable through
`trips.user_email`. Normally that redundancy is a smell — two copies that can
disagree. Here it is fine, for two specific reasons: the column is populated
*from the trip* on insert and never independently, and it is covered by
`idx_activities_user_trip`, so scoping is an index hit rather than a join.

Denormalisation is defensible when you can name the mechanism that keeps the
copies in sync. If you cannot, it is just duplication.

**`NULLS LAST` on priority, every time.**

```ts
sql`${activities.priorityScore} desc nulls last`
```

Extracted to a shared `byPriority` constant so the two list functions cannot
disagree. NULL means unrated; sorting it as 0 buries every activity nobody has
got round to rating — which is most of them, early on, when the feature most
needs to look useful.

**One list function, not two — and why the second one went away.**

There was briefly a `listWishlist` here: the same query as `listActivities`
plus a `NOT EXISTS` filter for activities on no day. It was removed, and the
reasoning is worth keeping because it generalises.

The argument *for* it was that "unassigned" is a real state — there is no
`activities.day_id` to be null (it was dropped in `0002` so one activity could
sit on several days), so "on no day" is a fact about the *absence of rows in
another table*. True, but that argues the state exists, not that it deserves
its own query.

The argument against won: it was `listActivities` minus a filter, serving no
screen, and it made `getItinerary` issue **two** reads whose answers could
disagree — a placement committed between them would put an activity in both
lists or neither. `getItinerary` now derives the split from the rows it has
already fetched, so both halves come from one snapshot.

The general lesson: a function that is another function plus a `WHERE` clause
earns its place only when something calls it *and* the database filter saves
real work. Otherwise it is a second thing to keep correct.

Deriving it also fixed a latent bug nobody had hit. The old `NOT EXISTS` was
global — it asked "is this activity on *any* day anywhere" — so an activity
referenced by a different trip's day would have vanished from this trip's
unassigned list. `placedActivityIds` is scoped to the days in hand, which is
the question actually worth asking.

**Convert at the edges.**

```ts
lat: draft.lat == null ? null : String(draft.lat),
```

Numbers in the API, strings in the database, converted in exactly two places:
here on the way in, and `toActivity` on the way out. The awkward
representation is confined to the boundary rather than leaking into every
caller.

---

## `placements.ts`

**The join *is* the authorization check.**

```sql
insert into day_itinerary_activities (day_id, activity_id, position)
select d.id, a.id, <position>
  from day_itineraries d
  join trips      t on t.id = d.trip_id and t.user_email = $1
  join activities a on a.trip_id = t.id and a.id = $2
 where d.id = $3
```

This is the most transferable idea in the layer. Three things happen at once:
ownership is proven, same-trip is proven, and the row is written — in one
statement, so there is no window where one holds and another does not.

Zero rows back is unambiguous: the day or activity is missing, is not yours,
or belongs to a different trip. All three are `NotFoundError`, which is both
correct and the safest default.

**Why this file is hand-written SQL when everything else uses the builder.**

`day_itinerary_activities` has two independent foreign keys and no composite
key carrying `trip_id`. Nothing in the database stops a day from one trip
being paired with an activity from another —
`sql/validate-itinerary.sql` check 9 demonstrates exactly that and reports it
as an unenforced FINDING.

So this file *is* the enforcement, and that is worth being explicit about: an
invariant enforced in application code is strictly weaker than one enforced by
the database. It is written down as such in `CLAUDE.md`, covered by a test,
and the proper fix is a migration. Knowing which of your invariants are real
constraints and which are conventions you are choosing to honour is most of
what "data integrity" means in practice.

**`DO UPDATE` instead of `DO NOTHING`, for an unobvious reason.**

```sql
on conflict (day_id, activity_id) do update set position = day_itinerary_activities.position
```

Writing a column to itself looks pointless. It is not. `DO NOTHING` returns
zero rows when the activity is already placed — which is indistinguishable
from "no such day", so an idempotent no-op would surface to the user as a
spurious "not found". The self-write makes the existing row the `RETURNING`
subject, so re-appending is a genuine no-op that returns the placement.

The general shape: when you use "zero rows" to mean failure, make sure success
can never also produce zero rows.

**Idempotency is a design decision, made per function.**

`appendActivityToDay` re-appending does *not* move the item to the end
(`set position = <existing>`). `placeActivityOnDay` called again *does*
reposition (`set position = excluded.position`). Same conflict, opposite
resolution, because the two functions mean different things. Double-clicking
"add" should not reorder your day.

**The extra read, and why honesty beat efficiency.**

```ts
const inserted = await db.execute<{ id: string }>(statement);
// ...then re-select the row through the builder
```

Drizzle's neon-http driver disables Postgres' own timestamp parsers and relies
on its column mappers to produce `Date`s. Those mappers **do not run for
`db.execute`**, so a `created_at` taken straight from `RETURNING` is a string
wearing a `Date` type.

The options were: ship the lie, hand-parse a non-ISO timestamp format, or
return the id and re-select. The extra round trip won because the *write* is
still one statement — the property that actually mattered — and the cost is a
few milliseconds on a personal travel app.

Optimising by lying in a type is borrowing against a debugging session later.

**Reorder in one statement with `CASE`.**

```ts
sql`case ${dayItineraryActivities.activityId} ${cases} else ${...position} end`
```

The obvious implementation is a loop of N updates. On a driver without
transactions, a failure halfway through leaves a day with two items at
position 3. One `UPDATE ... CASE` is atomic and simpler to reason about.

Renumbering the whole day beats fractional indexing here because a day holds a
handful of rows. Fractional indexing is the right answer at a thousand rows
and premature complexity at five.

---

## `index.ts`

**A barrel is a deliberate public surface, not an export dump.**

It re-exports the 22 functions, the DTO types, and the zod schemas — and
*not* `groupDays`, `withPgErrors`, or the internal row types. Those are
implementation details that happen to be exported so their own tests and
sibling modules can reach them.

Deciding what is public is a design act. Everything you export is something
you have promised not to break.

---

## The tests

**Three files, two of which never touch a database.**

`shape.test.ts` and `schemas.test.ts` run in milliseconds anywhere, so they run
constantly. `crud.test.ts` needs a real Neon database and is gated:

```ts
const DATABASE_URL = process.env.TEST_DATABASE_URL;
const live = DATABASE_URL ? describe : describe.skip;
```

`npm test` stays green and infrastructure-free for anyone who has not opted
in, and nothing is silently skipped for someone who has.

**Test the invariant, not the implementation.**

The valuable assertions are the ones that would have caught a real regression:
the empty day survives, NULL sorts last, the second `generateDays` changes
nothing, a Japan activity is refused on a Korea day, another user gets `null`.
Each corresponds to a rule someone could plausibly break while "cleaning up"
the code.

Tests that assert a function calls a query builder assert that the code is the
code. They pass forever and catch nothing.

**Let the cascades do the cleanup.**

```ts
await sql`delete from trips where user_email in (${EMAIL}, ${OTHER})`;
```

One statement per owner clears trips, days, placements and activities, because
the foreign keys cascade. The test emails are on a `.local` domain that cannot
collide with real data, and the suite was run twice in a row with row counts
checked before and after to prove it leaves nothing behind.

If a test writes to a shared database, proving its cleanup works is part of
writing it.

---

## Things I would flag as genuine tradeoffs

Not everything here is unambiguously right.

**Read-before-write in three places.** `updateTrip`, `addActivity` and
`addDay` verify ownership with a read, then write. The placement functions
prove ownership inside the write instead. The inconsistency is real; the
justification is that placements carry an invariant the database cannot
enforce, and the others do not. A stricter version would push all five into
`INSERT ... SELECT`.

**Two round trips per placement.** Discussed above. Worth revisiting if
placements ever land in a hot loop.

**Restating database constraints in zod.** Two copies of "priority is 1–5"
that could drift. The test is the mitigation, not a fix. Generating them from
the schema would remove the drift and reintroduce the narrower-request-shape
problem.

**Sorting twice.** Defended above, but it is genuinely redundant work, and a
reviewer would be right to ask.

Being able to name the weak points of your own design is worth more than a
design with no weak points, because the second thing does not exist.
