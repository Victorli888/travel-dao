-- Email one-time-passcode sign-in, plus server-side sessions.
--
-- email_otps: hashed (HMAC, keyed by AUTH_SECRET) single-use codes; a row is
--   written for every request, allowed or not, so rate limits are uniform.
-- auth_sessions: one row per signed-in browser; the Auth.js JWT carries its id
--   and is honoured only while the row is unrevoked and unexpired.
-- Neither table has an FK to allowed_emails: rows exist for addresses that are
-- not on the list (see the comment in lib/db/schema.ts).
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"provider" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"request_ip" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_user_email" ON "auth_sessions" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "idx_email_otps_email_created" ON "email_otps" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "idx_email_otps_ip_created" ON "email_otps" USING btree ("request_ip","created_at");