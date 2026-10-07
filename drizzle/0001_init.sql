CREATE TYPE "public"."vehicle_condition" AS ENUM('ok', 'damaged', 'non_running', 'parts', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."country" AS ENUM('CZ', 'SK');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('CZK', 'EUR');--> statement-breakpoint
CREATE TYPE "public"."fuel" AS ENUM('petrol', 'diesel', 'lpg', 'cng', 'hybrid', 'plugin_hybrid', 'electric', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."listing_kind" AS ENUM('car', 'parts', 'wanted', 'rental', 'other');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'removed', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'ok', 'failed');--> statement-breakpoint
CREATE TYPE "public"."seller" AS ENUM('private', 'dealer', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('manual', 'automatic', 'unknown');--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" integer NOT NULL,
	"listing_id" integer NOT NULL,
	"price_czk_at_save" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer,
	"job" varchar(30) NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"fetched" integer DEFAULT 0 NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"removed" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"llm_calls" integer DEFAULT 0 NOT NULL,
	"log" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"external_id" varchar(120) NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text,
	"price" integer,
	"currency" "currency" DEFAULT 'CZK' NOT NULL,
	"price_czk" integer,
	"location" text,
	"postal_code" varchar(10),
	"country" "country" NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"kind" "listing_kind" DEFAULT 'car' NOT NULL,
	"make" varchar(40),
	"model" varchar(60),
	"variant" text,
	"year" integer,
	"mileage_km" integer,
	"fuel" "fuel" DEFAULT 'unknown' NOT NULL,
	"transmission" "transmission" DEFAULT 'unknown' NOT NULL,
	"body_type" varchar(30),
	"power_kw" integer,
	"engine_ccm" integer,
	"condition" "vehicle_condition" DEFAULT 'unknown' NOT NULL,
	"condition_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seller" "seller" DEFAULT 'unknown' NOT NULL,
	"vat_deductible" boolean DEFAULT false NOT NULL,
	"service_book" boolean,
	"first_owner" boolean,
	"stk_valid_until" varchar(7),
	"parse_confidence" real DEFAULT 0 NOT NULL,
	"parsed_by" varchar(10) DEFAULT 'rules' NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"cluster_key" varchar(120),
	"market_median_czk" integer,
	"market_sample_size" integer,
	"deal_score" real,
	"report_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_cache" (
	"content_hash" varchar(64) PRIMARY KEY NOT NULL,
	"result" jsonb NOT NULL,
	"model" varchar(60) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"price" integer,
	"currency" "currency" NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"user_id" integer,
	"reason" varchar(30) NOT NULL,
	"message" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"query" text NOT NULL,
	"notify" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"new_matches" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(40) NOT NULL,
	"name" text NOT NULL,
	"country" "country" NOT NULL,
	"base_url" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"compliance_note" text,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(80),
	"role" "role" DEFAULT 'user' NOT NULL,
	"locale" varchar(2) DEFAULT 'cs' NOT NULL,
	"email_alerts" boolean DEFAULT true NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"blocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD CONSTRAINT "ingest_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_runs_started_idx" ON "ingest_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_source_ext_idx" ON "listings" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "listings_make_model_idx" ON "listings" USING btree ("make","model","year");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "listings" USING btree ("price_czk");--> statement-breakpoint
CREATE INDEX "listings_cluster_idx" ON "listings" USING btree ("cluster_key");--> statement-breakpoint
CREATE INDEX "listings_checked_idx" ON "listings" USING btree ("last_checked_at");--> statement-breakpoint
CREATE INDEX "listings_fts_idx" ON "listings" USING gin (to_tsvector('simple', unaccent_immutable("title" || ' ' || coalesce("make", '') || ' ' || coalesce("model", ''))));--> statement-breakpoint
CREATE INDEX "price_history_listing_idx" ON "price_history" USING btree ("listing_id","observed_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");