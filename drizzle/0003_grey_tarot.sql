-- Narrow the schema to itinerary planning.
--
-- IRREVERSIBLE. Drops seven tables and 26 rows of live data:
--   activity_categories (10)  ai_prompts (2)  countries (1)
--   trip_destinations (1)     user_activity_ratings (2)
--   user_category_ratings (10)  cities (0)
--
-- What this gives up, deliberately:
--   * A day's city. `trip_destinations` carried arrive/depart ranges, and a
--     day's location was derived by comparing its date against them. With the
--     table gone a trip has no geography at all.
--   * The suggestion lifecycle. `user_activity_ratings.status` was how a
--     rejected suggestion stayed suppressed without being deleted. Nothing
--     records rejection now, so the agent can re-suggest what was turned down.
--   * The prompt audit log.
--
-- The 0-10 `rating` is replaced by `activities.priority_score` (1-5) in 0004.
-- Both live rating rows were NULL, so no score data is lost; their
-- status='rejected' is.
--
-- Contents of the dropped tables were snapshotted to
-- scratch/dropped-tables-backup-2026-08-30.json before this ran.

ALTER TABLE "activity_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_prompts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "countries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_destinations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_activity_ratings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_category_ratings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "activity_categories" CASCADE;--> statement-breakpoint
DROP TABLE "ai_prompts" CASCADE;--> statement-breakpoint
DROP TABLE "cities" CASCADE;--> statement-breakpoint
DROP TABLE "countries" CASCADE;--> statement-breakpoint
DROP TABLE "trip_destinations" CASCADE;--> statement-breakpoint
DROP TABLE "user_activity_ratings" CASCADE;--> statement-breakpoint
DROP TABLE "user_category_ratings" CASCADE;--> statement-breakpoint
-- NOTE: the two DROP CONSTRAINT statements below say IF EXISTS by hand.
-- drizzle-kit generated them unguarded, but the DROP TABLE ... CASCADE above
-- has already removed both FKs, so unguarded they fail with
--   ERROR: constraint "activities_city_id_fkey" ... does not exist
-- and the whole migration aborts.

ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "activities_city_id_fkey";
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "activities_category_id_fkey";
--> statement-breakpoint
ALTER TABLE "activities" DROP COLUMN "city_id";--> statement-breakpoint
ALTER TABLE "activities" DROP COLUMN "category_id";