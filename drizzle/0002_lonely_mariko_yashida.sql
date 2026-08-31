CREATE TABLE "itinerary_day_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_day_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_activities_day";--> statement-breakpoint
ALTER TABLE "itinerary_day_activities" ADD CONSTRAINT "itinerary_day_activities_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "public"."itinerary_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_day_activities" ADD CONSTRAINT "itinerary_day_activities_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "itinerary_day_activities_day_id_activity_id_key" ON "itinerary_day_activities" USING btree ("day_id","activity_id");--> statement-breakpoint
CREATE INDEX "idx_ida_day" ON "itinerary_day_activities" USING btree ("day_id","position");--> statement-breakpoint
CREATE INDEX "idx_ida_activity" ON "itinerary_day_activities" USING btree ("activity_id");--> statement-breakpoint
-- Hand-added: carry existing schedules across before the columns go away.
-- Must run after the table and its FKs exist and before the DROP COLUMNs.
-- A no-op against the current database (every activity has day_id NULL), but
-- keeps this migration correct on a Neon branch or any environment that does
-- have scheduled rows.
INSERT INTO "itinerary_day_activities" ("day_id", "activity_id", "position")
SELECT "day_id", "id", "position" FROM "activities" WHERE "day_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "activities" DROP COLUMN "day_id";--> statement-breakpoint
ALTER TABLE "activities" DROP COLUMN "position";