/**
 * Schema source of truth. Edit here, then `db:generate` → review SQL → `db:migrate`.
 * `0000` is a no-op baseline (tables predated migrations). Do not "fix" `text_ops`.
 * No `users` table: ownership is `user_email` → `allowed_emails`.
 */
import { sql } from "drizzle-orm";
import {
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
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Access control                                                             */
/* -------------------------------------------------------------------------- */

/** Allow-list. Store emails lower-case; `lib/auth/allowlist.ts` lower-cases on lookup. */
export const allowedEmails = pgTable(
  "allowed_emails",
  {
    id: serial("id").primaryKey().notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique("allowed_emails_email_key").on(t.email)],
);

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

/*
 * Neither table has a foreign key to `allowed_emails`, on purpose. A row here
 * is not ownership — it is a sign-in attempt or a live session — and both
 * exist for addresses that are *not* on the list: an OTP request is recorded
 * for every address so rate limits and response timing are the same whether
 * or not it can sign in, and a Google user who is turned away still holds a
 * session so `/unauthorized` can show them who they are.
 */

/**
 * One-time sign-in codes. `code_hash` is an HMAC of the email and the code
 * keyed by `AUTH_SECRET` — the code itself is never stored. Only the newest
 * row for an email is ever checked; older ones are dead on arrival of a new
 * one. `attempts` caps guesses, `consumed_at` makes a code single-use.
 */
export const emailOtps = pgTable(
  "email_otps",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    /** NULL when the request carried no client address; skips the IP limit. */
    requestIp: text("request_ip"),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_email_otps_email_created").on(t.email, t.createdAt),
    index("idx_email_otps_ip_created").on(t.requestIp, t.createdAt),
  ],
);

/**
 * Server-side record of every signed-in browser. The session cookie is an
 * Auth.js JWT carrying this row's `id`; the JWT is only honoured while the row
 * is unrevoked and unexpired, which is what makes sign-out and revocation
 * real rather than "delete the cookie and hope".
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userEmail: text("user_email").notNull(),
    /** Auth.js provider id: `google` or `email-otp`. */
    provider: text("provider").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_auth_sessions_user_email").on(t.userEmail)],
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
      t.userEmail.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [t.userEmail],
      foreignColumns: [allowedEmails.email],
      name: "trips_user_email_fkey",
    }),
    check(
      "trips_status_check",
      sql`status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'archived'::text])`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Itinerary                                                                  */
/* -------------------------------------------------------------------------- */

/** One row per (trip, date). Location is inferred from placed activities, if at all. */
export const dayItineraries = pgTable(
  "day_itineraries",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tripId: uuid("trip_id").notNull(),
    date: date("date").notNull(),
    /** User-given label, e.g. "Temple day". NULL = unnamed; fall back to the date. */
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("day_itineraries_trip_id_date_key").on(t.tripId, t.date),
    foreignKey({
      columns: [t.tripId],
      foreignColumns: [trips.id],
      name: "day_itineraries_trip_id_fkey",
    }).onDelete("cascade"),
  ],
);

/* -------------------------------------------------------------------------- */
/* Activities                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One place per trip. Schedule lives on `day_itinerary_activities`, not a `day_id`.
 * No placement = wishlist (LEFT JOIN; INNER JOIN drops them).
 * Delete day → placements go, activity stays. Delete trip → activity goes.
 * `priority_score` is 1–5; NULL means unrated. `lat`/`lng`/`duration_minutes` are usually NULL.
 */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userEmail: text("user_email").notNull(),
    tripId: uuid("trip_id").notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    address: text("address"),
    /**
     * The neighbourhood a place sits in — "Pontochō", "Northern
     * Higashiyama". The Activity Bank's second line. NULL means *not
     * recorded*, and the bank simply omits the line; it is not a
     * substring of `address`, and must never be derived from one.
     */
    area: text("area"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    /** e.g. "Tue–Sun 11am–7pm". */
    hoursOperation: text("hours_operation"),
    source: text("source").default("ai_generated").notNull(),
    sourceMetadata: jsonb("source_metadata"),
    durationMinutes: integer("duration_minutes"),
    /** 1 = maybe, 5 = must-do. NULL = unrated. */
    priorityScore: integer("priority_score"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_activities_user_trip").using(
      "btree",
      t.userEmail.asc().nullsLast().op("text_ops"),
      t.tripId.asc().nullsLast().op("text_ops"),
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
    check(
      "activities_priority_score_check",
      sql`(priority_score >= 1) AND (priority_score <= 5)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Placements                                                                 */
/* -------------------------------------------------------------------------- */
/**
 * Day ↔ activity. Declared after `activities` so the FK can see it.
 * `UNIQUE (day_id, activity_id)`: once per day.
 */
export const dayItineraryActivities = pgTable(
  "day_itinerary_activities",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    dayId: uuid("day_id").notNull(),
    activityId: uuid("activity_id").notNull(),
    /** NULL = unordered, not first. */
    position: integer("position"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("day_itinerary_activities_day_id_activity_id_key").on(
      t.dayId,
      t.activityId,
    ),
    index("idx_dia_day").on(t.dayId, t.position),
    index("idx_dia_activity").on(t.activityId),
    foreignKey({
      columns: [t.dayId],
      foreignColumns: [dayItineraries.id],
      name: "day_itinerary_activities_day_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.activityId],
      foreignColumns: [activities.id],
      name: "day_itinerary_activities_activity_id_fkey",
    }).onDelete("cascade"),
  ],
);
