ALTER TABLE "itinerary_days" RENAME TO "day_itinerary";
--> statement-breakpoint
ALTER INDEX "itinerary_days_trip_id_date_key" RENAME TO "day_itinerary_trip_id_date_key";
--> statement-breakpoint
ALTER TABLE "day_itinerary" RENAME CONSTRAINT "itinerary_days_trip_id_fkey" TO "day_itinerary_trip_id_fkey";
