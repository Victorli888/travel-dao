ALTER TABLE "itinerary_day_activities" RENAME TO "day_itinerary_activities";--> statement-breakpoint
ALTER TABLE "day_itinerary_activities" DROP CONSTRAINT "itinerary_day_activities_day_id_fkey";
--> statement-breakpoint
ALTER TABLE "day_itinerary_activities" DROP CONSTRAINT "itinerary_day_activities_activity_id_fkey";
--> statement-breakpoint
DROP INDEX "itinerary_day_activities_day_id_activity_id_key";--> statement-breakpoint
DROP INDEX "idx_ida_day";--> statement-breakpoint
DROP INDEX "idx_ida_activity";--> statement-breakpoint
ALTER TABLE "day_itinerary_activities" ADD CONSTRAINT "day_itinerary_activities_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "public"."day_itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_itinerary_activities" ADD CONSTRAINT "day_itinerary_activities_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "day_itinerary_activities_day_id_activity_id_key" ON "day_itinerary_activities" USING btree ("day_id","activity_id");--> statement-breakpoint
CREATE INDEX "idx_dia_day" ON "day_itinerary_activities" USING btree ("day_id","position");--> statement-breakpoint
CREATE INDEX "idx_dia_activity" ON "day_itinerary_activities" USING btree ("activity_id");--> statement-breakpoint
ALTER TABLE "activities" DROP COLUMN "price_tier";
--> statement-breakpoint
-- Hand-added: ALTER TABLE ... RENAME TO does not rename the primary key
-- constraint, and drizzle-kit does not model single-column PK names in its
-- snapshot, so it will never emit these. Without them the database keeps a
-- table called "day_itineraries" whose PK is named "itinerary_days_pkey".
-- 0005/0006 renamed the table and its FK/index but missed this.
ALTER TABLE "day_itineraries" RENAME CONSTRAINT "itinerary_days_pkey" TO "day_itineraries_pkey";
--> statement-breakpoint
ALTER TABLE "day_itinerary_activities" RENAME CONSTRAINT "itinerary_day_activities_pkey" TO "day_itinerary_activities_pkey";
