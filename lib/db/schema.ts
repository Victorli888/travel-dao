/**
 * The single source of truth for the database.
 *
 * These tables were hand-created against Neon before this repo had migrations,
 * so `drizzle/0000_*.sql` is a descriptive no-op baseline rather than something
 * that ever ran. Everything from `0001` onward is generated from this file:
 * edit here, then `npm run db:generate` → review the SQL → `npm run db:migrate`.
 *
 * Identity convention: there is no `users` table. Ownership is the signed-in
 * email, carried as `user_email` and constrained against `allowed_emails`.
 * Auth.js stores no user rows — the allow-list *is* the user table.
 *
 * Index operator classes below (`text_ops` / `uuid_ops`) mirror what is
 * physically in Postgres today, including a few that read as mismatched. They
 * are recorded, not chosen; changing one here would emit a migration that
 * rebuilds the index.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Access control                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The allow-list. Sign-in alone does not grant access — the email must appear
 * here, and every owned row points back at it. Emails are stored lower-case;
 * `lib/auth/allowlist.ts` lower-cases before lookup.
 */
export const allowedEmails = pgTable(
  "allowed_emails",
  {
    id: serial("id").primaryKey().notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique("allowed_emails_email_key").on(t.email)]
);

/* -------------------------------------------------------------------------- */
/* Reference data — shared across all users, not owned by anyone              */
/* -------------------------------------------------------------------------- */

export const countries = pgTable(
  "countries",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    name: text("name").notNull(),
    isoCode: varchar("iso_code", { length: 3 }),
  },
  (t) => [unique("countries_iso_code_key").on(t.isoCode)]
);

export const cities = pgTable(
  "cities",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    countryId: uuid("country_id").notNull(),
    name: text("name").notNull(),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
  },
  (t) => [
    foreignKey({
      columns: [t.countryId],
      foreignColumns: [countries.id],
      name: "cities_country_id_fkey",
    }),
  ]
);

/**
 * The taxonomy the research agent scores against. `is_active` retires a
 * category without deleting rows that reference it.
 */
export const activityCategories = pgTable(
  "activity_categories",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (t) => [
    unique("activity_categories_name_key").on(t.name),
    unique("activity_categories_slug_key").on(t.slug),
  ]
);

/* -------------------------------------------------------------------------- */
/* Trips                                                                      */
/* -------------------------------------------------------------------------- */

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userEmail: text("user_email").notNull(),
    name: text("name").notNull(),
    status: text("status").default("draft").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_trips_user_email").using(
      "btree",
      t.userEmail.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [t.userEmail],
      foreignColumns: [allowedEmails.email],
      name: "trips_user_email_fkey",
    }),
    check(
      "trips_status_check",
      sql`status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'archived'::text])`
    ),
  ]
);

/**
 * The cities/countries a trip passes through, in `visit_order`. A trip may
 * have several; `itinerary_days` deliberately does *not* hang off these —
 * a day belongs to the trip, and which destination it falls in is derived by
 * comparing its date against arrive/depart.
 */
export const tripDestinations = pgTable(
  "trip_destinations",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tripId: uuid("trip_id").notNull(),
    countryId: uuid("country_id").notNull(),
    cityId: uuid("city_id"),
    visitOrder: integer("visit_order").default(0).notNull(),
    arriveDate: date("arrive_date"),
    departDate: date("depart_date"),
  },
  (t) => [
    index("idx_trip_destinations_trip").using(
      "btree",
      t.tripId.asc().nullsLast().op("uuid_ops")
    ),
    foreignKey({
      columns: [t.tripId],
      foreignColumns: [trips.id],
      name: "trip_destinations_trip_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.countryId],
      foreignColumns: [countries.id],
      name: "trip_destinations_country_id_fkey",
    }),
    foreignKey({
      columns: [t.cityId],
      foreignColumns: [cities.id],
      name: "trip_destinations_city_id_fkey",
    }),
  ]
);

/* -------------------------------------------------------------------------- */
/* Itinerary                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One calendar day of a trip.
 *
 * Hangs off the trip, not off `trip_destinations`: a day is a date, and on a
 * multi-city trip the city is derivable by comparing that date against each
 * destination's arrive/depart range. Tying days to destinations instead would
 * force every trip to declare a destination before it could hold any days.
 *
 * `UNIQUE (trip_id, date)` makes "one row per calendar day" a database
 * invariant, so day generation can be a plain upsert rather than a
 * read-then-write.
 */
export const itineraryDays = pgTable(
  "itinerary_days",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tripId: uuid("trip_id").notNull(),
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("itinerary_days_trip_id_date_key").on(t.tripId, t.date),
    foreignKey({
      columns: [t.tripId],
      foreignColumns: [trips.id],
      name: "itinerary_days_trip_id_fkey",
    }).onDelete("cascade"),
  ]
);

/* -------------------------------------------------------------------------- */
/* Activities                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Something to do — one row per real-world place, per trip. Always belongs to a
 * trip (`trip_id` is NOT NULL and cascades), so an activity is never orphaned.
 *
 * This row says *what the place is*, never *when we are going*. Scheduling
 * lives in `itinerary_day_activities` below, because an activity may recur
 * across days and a single `day_id` column could only ever hold one of them.
 *
 * An activity with **no** placement row is an unscheduled wishlist item — that
 * is by design, not missing data. Never filter it out by default and never
 * treat it as an error state. Reading days therefore LEFT JOINs through the
 * placement table; an INNER JOIN silently drops every wishlist item, which
 * reads as data loss rather than a bug.
 *
 * The two deletes still differ on purpose: deleting a *day* cascades away its
 * placements and leaves the activities alone (they fall back to the wishlist),
 * while deleting a *trip* destroys them outright. These are product decisions,
 * not defaults.
 *
 * `lat`/`lng`/`duration_minutes`/`price_tier` exist to serve a day-optimizer,
 * not the CRUD UI — they are expected to be NULL for most rows.
 */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userEmail: text("user_email").notNull(),
    tripId: uuid("trip_id").notNull(),
    cityId: uuid("city_id"),
    categoryId: uuid("category_id"),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    address: text("address"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    /** Opening hours as the agent wrote them, e.g. "Tue–Sun 11am–7pm". */
    hoursOperation: text("hours_operation"),
    source: text("source").default("ai_generated").notNull(),
    sourceMetadata: jsonb("source_metadata"),
    durationMinutes: integer("duration_minutes"),
    priceTier: text("price_tier"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_activities_user_trip").using(
      "btree",
      t.userEmail.asc().nullsLast().op("text_ops"),
      t.tripId.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [t.userEmail],
      foreignColumns: [allowedEmails.email],
      name: "activities_user_email_fkey",
    }),
    foreignKey({
      columns: [t.tripId],
      foreignColumns: [trips.id],
      name: "activities_trip_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.cityId],
      foreignColumns: [cities.id],
      name: "activities_city_id_fkey",
    }),
    foreignKey({
      columns: [t.categoryId],
      foreignColumns: [activityCategories.id],
      name: "activities_category_id_fkey",
    }),
  ]
);

/**
 * Which activities are scheduled on which day.
 *
 * A join table, because this is many-to-many: a day holds many activities and
 * an activity may recur across days (a two-day park ticket, a cafe worth a
 * second visit). A single `activities.day_id` column could only ever hold one
 * day, so the alternative was cloning the activity row per day — and
 * `user_activity_ratings` is keyed on `activity_id`, so each clone would
 * collect its own rating for what is one real place. Cloning also fans every
 * edit to `address`/`hours_operation`/`summary` out across rows with nothing in
 * the schema linking them.
 *
 * Declared *after* `activities` rather than up in the Itinerary section next to
 * `itinerary_days`: the foreign key below reads `activities.id`, and drizzle
 * evaluates this callback while `pgTable` runs, so an earlier declaration would
 * hit the temporal dead zone at module load.
 *
 * `position` lives here rather than on `activities` because ordering is a
 * property of the placement, not of the place — the same activity is first on
 * one day and third on another. NULL still means *unordered*, not first.
 *
 * `UNIQUE (day_id, activity_id)` is a deliberate call, not a formality: it
 * blocks the same activity twice on one day, so a morning visit plus an evening
 * return is one row and a note rather than two rows. Accidental double-adds are
 * likelier than intentional same-day repeats. Dropping the constraint later is
 * a one-line migration if that turns out to be wrong.
 */
export const itineraryDayActivities = pgTable(
  "itinerary_day_activities",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    dayId: uuid("day_id").notNull(),
    activityId: uuid("activity_id").notNull(),
    /** Manual order within the day. NULL means unordered, not first. */
    position: integer("position"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("itinerary_day_activities_day_id_activity_id_key").on(
      t.dayId,
      t.activityId
    ),
    /** Serves "the activities on this day, in order". */
    index("idx_ida_day").on(t.dayId, t.position),
    /** Serves "which days is this activity on". */
    index("idx_ida_activity").on(t.activityId),
    foreignKey({
      columns: [t.dayId],
      foreignColumns: [itineraryDays.id],
      name: "itinerary_day_activities_day_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.activityId],
      foreignColumns: [activities.id],
      name: "itinerary_day_activities_activity_id_fkey",
    }).onDelete("cascade"),
  ]
);

/* -------------------------------------------------------------------------- */
/* Ratings                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One row per (user, trip, activity). `status` carries the lifecycle —
 * a `rejected` row is how a suggestion is suppressed, so these rows are
 * filtered *in*, never deleted.
 */
export const userActivityRatings = pgTable(
  "user_activity_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userEmail: text("user_email").notNull(),
    tripId: uuid("trip_id").notNull(),
    activityId: uuid("activity_id").notNull(),
    rating: numeric("rating", { precision: 3, scale: 1 }),
    status: text("status").default("suggested").notNull(),
    notes: text("notes"),
    ratedAt: timestamp("rated_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_uar_trip_status").using(
      "btree",
      t.tripId.asc().nullsLast().op("text_ops"),
      t.status.asc().nullsLast().op("uuid_ops")
    ),
    index("idx_uar_user_trip").using(
      "btree",
      t.userEmail.asc().nullsLast().op("text_ops"),
      t.tripId.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [t.userEmail],
      foreignColumns: [allowedEmails.email],
      name: "user_activity_ratings_user_email_fkey",
    }),
    foreignKey({
      columns: [t.tripId],
      foreignColumns: [trips.id],
      name: "user_activity_ratings_trip_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.activityId],
      foreignColumns: [activities.id],
      name: "user_activity_ratings_activity_id_fkey",
    }).onDelete("cascade"),
    unique("user_activity_ratings_user_email_trip_id_activity_id_key").on(
      t.userEmail,
      t.tripId,
      t.activityId
    ),
    check(
      "user_activity_ratings_rating_check",
      sql`(rating >= (0)::numeric) AND (rating <= (10)::numeric)`
    ),
    check(
      "user_activity_ratings_status_check",
      sql`status = ANY (ARRAY['suggested'::text, 'approved'::text, 'rejected'::text, 'saved'::text, 'rated'::text])`
    ),
  ]
);

/**
 * How much a user likes a category, either globally (`trip_id` NULL) or for
 * one trip. The two partial unique indexes are what keep those cases from
 * colliding — a plain unique on (user, trip, category) would let duplicate
 * global rows through, since NULL never equals NULL.
 */
export const userCategoryRatings = pgTable(
  "user_category_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userEmail: text("user_email").notNull(),
    tripId: uuid("trip_id"),
    categoryId: uuid("category_id").notNull(),
    rating: numeric("rating", { precision: 3, scale: 1 }).notNull(),
    calibratedAt: timestamp("calibrated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("idx_ucr_global")
      .using(
        "btree",
        t.userEmail.asc().nullsLast().op("text_ops"),
        t.categoryId.asc().nullsLast().op("text_ops")
      )
      .where(sql`(trip_id IS NULL)`),
    uniqueIndex("idx_ucr_trip")
      .using(
        "btree",
        t.userEmail.asc().nullsLast().op("uuid_ops"),
        t.tripId.asc().nullsLast().op("text_ops"),
        t.categoryId.asc().nullsLast().op("text_ops")
      )
      .where(sql`(trip_id IS NOT NULL)`),
    index("idx_ucr_user_trip").using(
      "btree",
      t.userEmail.asc().nullsLast().op("text_ops"),
      t.tripId.asc().nullsLast().op("uuid_ops")
    ),
    foreignKey({
      columns: [t.userEmail],
      foreignColumns: [allowedEmails.email],
      name: "user_category_ratings_user_email_fkey",
    }),
    foreignKey({
      columns: [t.tripId],
      foreignColumns: [trips.id],
      name: "user_category_ratings_trip_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.categoryId],
      foreignColumns: [activityCategories.id],
      name: "user_category_ratings_category_id_fkey",
    }),
    check(
      "user_category_ratings_rating_check",
      sql`(rating >= (0)::numeric) AND (rating <= (10)::numeric)`
    ),
  ]
);

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

/** Append-only log of what was sent to the model and what came back. */
export const aiPrompts = pgTable(
  "ai_prompts",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tripId: uuid("trip_id").notNull(),
    userEmail: text("user_email").notNull(),
    promptText: text("prompt_text").notNull(),
    responseRaw: text("response_raw"),
    model: text("model").notNull(),
    tokensUsed: integer("tokens_used"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tripId],
      foreignColumns: [trips.id],
      name: "ai_prompts_trip_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.userEmail],
      foreignColumns: [allowedEmails.email],
      name: "ai_prompts_user_email_fkey",
    }),
  ]
);
