CREATE TABLE "channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"shop_id" uuid,
	"telegram_channel_id" bigint NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_telegram_channel_id_unique" UNIQUE("telegram_channel_id")
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"phash" text,
	"width" integer,
	"height" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" uuid NOT NULL,
	"shop_id" uuid,
	"category_id" integer,
	"category" text DEFAULT 'other' NOT NULL,
	"title_ru" text DEFAULT '' NOT NULL,
	"title_uz" text DEFAULT '' NOT NULL,
	"description_ru" text DEFAULT '' NOT NULL,
	"description_uz" text DEFAULT '' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"condition" text,
	"price" bigint,
	"currency" text DEFAULT 'UZS' NOT NULL,
	"district" text,
	"allowed_delivery_modes" text[] DEFAULT ARRAY['delivery_only','cod_seller']::text[] NOT NULL,
	"fee_payer" text DEFAULT 'buyer' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"moderation_reason" text,
	"risk_score" integer,
	"ai_draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_suggestion" jsonb,
	"source_text" text,
	"views" integer DEFAULT 0 NOT NULL,
	"favorites_count" integer DEFAULT 0 NOT NULL,
	"requests_count" integer DEFAULT 0 NOT NULL,
	"channel_posts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sold_via" text,
	"sold_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"bumped_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"market_location" text,
	"photo_key" text,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_owner_user_id_unique" UNIQUE("owner_user_id")
);
--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_photos_listing_idx" ON "listing_photos" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_photos_phash_idx" ON "listing_photos" USING btree ("phash");--> statement-breakpoint
CREATE INDEX "listings_seller_status_idx" ON "listings" USING btree ("seller_user_id","status");--> statement-breakpoint
CREATE INDEX "listings_status_bumped_idx" ON "listings" USING btree ("status","bumped_at");