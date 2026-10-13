CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"prompt_id" text,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"slug" text NOT NULL,
	"name_ru" text NOT NULL,
	"name_uz" text NOT NULL,
	"attributes_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"lang" text NOT NULL,
	"input_type" text NOT NULL,
	"extracted" jsonb NOT NULL,
	"price_verdict" text NOT NULL,
	"price_diff_pct" integer,
	"price_uzs" bigint,
	"price_source" text NOT NULL,
	"risk_score" integer NOT NULL,
	"risk_level" text NOT NULL,
	"flags" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_reference" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"model_key" text NOT NULL,
	"price_min" bigint NOT NULL,
	"price_median" bigint NOT NULL,
	"price_max" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "price_reference_model_key_unique" UNIQUE("model_key")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" bigint NOT NULL,
	"phone" text,
	"language" text DEFAULT 'uz' NOT NULL,
	"role" text DEFAULT 'buyer' NOT NULL,
	"accepted_terms_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"banned_at" timestamp with time zone,
	"ban_reason" text,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_reference" ADD CONSTRAINT "price_reference_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "checks_user_created_idx" ON "checks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "price_reference_model_key_trgm" ON "price_reference" USING gin ("model_key" gin_trgm_ops);