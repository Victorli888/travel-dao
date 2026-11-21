CREATE TABLE "itinerary_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "day_id" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "hours_operation" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "itinerary_days_trip_id_date_key" ON "itinerary_days" USING btree ("trip_id","date");--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "public"."itinerary_days"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activities_day" ON "activities" USING btree ("day_id","position");