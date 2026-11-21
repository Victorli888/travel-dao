ALTER TABLE "day_itinerary" RENAME TO "day_itineraries";
--> statement-breakpoint
ALTER INDEX "day_itinerary_trip_id_date_key" RENAME TO "day_itineraries_trip_id_date_key";
--> statement-breakpoint
ALTER TABLE "day_itineraries" RENAME CONSTRAINT "day_itinerary_trip_id_fkey" TO "day_itineraries_trip_id_fkey";
