-- BASELINE — descriptive only, intentionally a no-op.
--
-- These 10 tables were hand-created directly against Neon before this repo
-- had migrations. This file records them so drizzle has a snapshot to diff
-- against; running it must not try to create what already exists, so the
-- whole body stays inside a block comment (drizzle generates it this way for
-- an introspected schema). Drizzle's per-statement split markers were
-- removed because they would split the comment into unterminated fragments.
--
-- To bootstrap a *fresh* database, uncomment the body and run it first.
/*
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"iso_code" varchar(3),
	CONSTRAINT "countries_iso_code_key" UNIQUE("iso_code")
);

CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_id" uuid NOT NULL,
	"name" text NOT NULL,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6)
);

CREATE TABLE "allowed_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "allowed_emails_email_key" UNIQUE("email")
);

CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'archived'::text]))
);

CREATE TABLE "trip_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"country_id" uuid NOT NULL,
	"city_id" uuid,
	"visit_order" integer DEFAULT 0 NOT NULL,
	"arrive_date" date,
	"depart_date" date
);

CREATE TABLE "user_category_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"trip_id" uuid,
	"category_id" uuid NOT NULL,
	"rating" numeric(3, 1) NOT NULL,
	"calibrated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_category_ratings_rating_check" CHECK ((rating >= (0)::numeric) AND (rating <= (10)::numeric))
);

CREATE TABLE "activity_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "activity_categories_name_key" UNIQUE("name"),
	CONSTRAINT "activity_categories_slug_key" UNIQUE("slug")
);

CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"trip_id" uuid NOT NULL,
	"city_id" uuid,
	"category_id" uuid,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"address" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"source" text DEFAULT 'ai_generated' NOT NULL,
	"source_metadata" jsonb,
	"duration_minutes" integer,
	"price_tier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "ai_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_email" text NOT NULL,
	"prompt_text" text NOT NULL,
	"response_raw" text,
	"model" text NOT NULL,
	"tokens_used" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_activity_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"trip_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"rating" numeric(3, 1),
	"status" text DEFAULT 'suggested' NOT NULL,
	"notes" text,
	"rated_at" timestamp with time zone,
	CONSTRAINT "user_activity_ratings_user_email_trip_id_activity_id_key" UNIQUE("user_email","trip_id","activity_id"),
	CONSTRAINT "user_activity_ratings_rating_check" CHECK ((rating >= (0)::numeric) AND (rating <= (10)::numeric)),
	CONSTRAINT "user_activity_ratings_status_check" CHECK (status = ANY (ARRAY['suggested'::text, 'approved'::text, 'rejected'::text, 'saved'::text, 'rated'::text]))
);

ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."allowed_emails"("email") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trip_destinations" ADD CONSTRAINT "trip_destinations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trip_destinations" ADD CONSTRAINT "trip_destinations_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trip_destinations" ADD CONSTRAINT "trip_destinations_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_category_ratings" ADD CONSTRAINT "user_category_ratings_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."allowed_emails"("email") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_category_ratings" ADD CONSTRAINT "user_category_ratings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_category_ratings" ADD CONSTRAINT "user_category_ratings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."activity_categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."allowed_emails"("email") ON DELETE no action ON UPDATE no action;
ALTER TABLE "activities" ADD CONSTRAINT "activities_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "activities" ADD CONSTRAINT "activities_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "activities" ADD CONSTRAINT "activities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."activity_categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."allowed_emails"("email") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_activity_ratings" ADD CONSTRAINT "user_activity_ratings_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."allowed_emails"("email") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_activity_ratings" ADD CONSTRAINT "user_activity_ratings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_activity_ratings" ADD CONSTRAINT "user_activity_ratings_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_trips_user_email" ON "trips" USING btree ("user_email" text_ops);
CREATE INDEX "idx_trip_destinations_trip" ON "trip_destinations" USING btree ("trip_id" uuid_ops);
CREATE UNIQUE INDEX "idx_ucr_global" ON "user_category_ratings" USING btree ("user_email" text_ops,"category_id" text_ops) WHERE (trip_id IS NULL);
CREATE UNIQUE INDEX "idx_ucr_trip" ON "user_category_ratings" USING btree ("user_email" uuid_ops,"trip_id" text_ops,"category_id" text_ops) WHERE (trip_id IS NOT NULL);
CREATE INDEX "idx_ucr_user_trip" ON "user_category_ratings" USING btree ("user_email" text_ops,"trip_id" uuid_ops);
CREATE INDEX "idx_activities_user_trip" ON "activities" USING btree ("user_email" text_ops,"trip_id" text_ops);
CREATE INDEX "idx_uar_trip_status" ON "user_activity_ratings" USING btree ("trip_id" text_ops,"status" uuid_ops);
CREATE INDEX "idx_uar_user_trip" ON "user_activity_ratings" USING btree ("user_email" text_ops,"trip_id" text_ops);
*/