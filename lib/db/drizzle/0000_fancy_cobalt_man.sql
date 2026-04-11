CREATE TYPE "public"."availability_status" AS ENUM('taking_orders', 'preorder', 'sold_out', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."pricing_type" AS ENUM('unit', 'deposit');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('eggs_chicken', 'eggs_duck', 'meat_chicken', 'meat_turkey');--> statement-breakpoint
CREATE TYPE "public"."batch_status" AS ENUM('open', 'closed', 'complete');--> statement-breakpoint
CREATE TYPE "public"."pickup_event_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'deposit_paid', 'cash_pending', 'pickup_assigned', 'weights_entered', 'invoice_sent', 'fulfilled', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('stripe', 'cash');--> statement-breakpoint
CREATE TYPE "public"."order_event_type" AS ENUM('note', 'status_change', 'refund', 'invoice_sent', 'pickup_assigned', 'weights_entered');--> statement-breakpoint
CREATE TYPE "public"."animal_status_enum" AS ENUM('active', 'sold', 'deceased');--> statement-breakpoint
CREATE TYPE "public"."egg_inventory_lot_status" AS ENUM('open', 'depleted');--> statement-breakpoint
CREATE TYPE "public"."flock_event_type" AS ENUM('acquired', 'hatched', 'culled', 'sold', 'died');--> statement-breakpoint
CREATE TYPE "public"."flock_species" AS ENUM('chicken', 'duck', 'turkey');--> statement-breakpoint
CREATE TYPE "public"."flock_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."sex_enum" AS ENUM('hen', 'rooster', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."farmops_addon_type" AS ENUM('custom_domain', 'sms_notifications', 'extra_admin_users', 'white_label');--> statement-breakpoint
CREATE TYPE "public"."farmops_plan" AS ENUM('starter', 'growth', 'pro');--> statement-breakpoint
CREATE TYPE "public"."farmops_tenant_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'paused');--> statement-breakpoint
CREATE TYPE "public"."farmops_user_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."farmops_sms_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"object_key" text NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"product_type" "product_type" NOT NULL,
	"pricing_type" "pricing_type" NOT NULL,
	"price_in_cents" integer NOT NULL,
	"unit_label" text,
	"deposit_description" text,
	"availability" "availability_status" DEFAULT 'taking_orders' NOT NULL,
	"image_url" text,
	"is_on_sale" boolean DEFAULT false NOT NULL,
	"sale_price_cents" integer,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notify_me" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"email" text NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"global_unsubscribe" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notify_me_unsubscribe_token_unique" UNIQUE("unsubscribe_token"),
	CONSTRAINT "notify_me_product_id_email_unique" UNIQUE("product_id","email")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text,
	"password_hash" text,
	"name" text NOT NULL,
	"phone" text,
	"notes" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"verification_token" text,
	"reset_token" text,
	"reset_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preorder_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"status" "batch_status" DEFAULT 'open' NOT NULL,
	"capacity_birds" integer NOT NULL,
	"price_per_lb_cents_whole" integer NOT NULL,
	"price_per_lb_cents_half" integer NOT NULL,
	"price_per_lb_cents_quarter" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"name" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"location_notes" text,
	"status" "pickup_event_status" DEFAULT 'scheduled' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"pricing_type" text NOT NULL,
	"unit_price_in_cents" integer NOT NULL,
	"unit_label" text,
	"variant_label" text,
	"is_giblets" boolean DEFAULT false NOT NULL,
	"line_total_in_cents" integer NOT NULL,
	"pickup_event_id" integer
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"source" text DEFAULT 'storefront' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_checkout_url" text,
	"stripe_payment_intent_id" text,
	"total_in_cents" integer NOT NULL,
	"notes" text,
	"claim_token" text,
	"claim_token_expires_at" timestamp with time zone,
	"batch_id" integer,
	"pickup_event_id" integer,
	"refunded_giblets" boolean DEFAULT false NOT NULL,
	"stripe_refund_id" text,
	"stripe_invoice_id" text,
	"final_weight_lbs" double precision,
	"applied_coupon_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"event_type" "order_event_type" NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_pending_checkouts" (
	"stripe_session_id" text PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"notes" text,
	"cart_snapshot" jsonb NOT NULL,
	"total_in_cents" integer NOT NULL,
	"applied_coupon_code" text,
	"pickup_event_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_carts" (
	"customer_id" integer PRIMARY KEY NOT NULL,
	"items" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animals" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"name" text,
	"species" "flock_species" NOT NULL,
	"breed" text,
	"sex" "sex_enum" DEFAULT 'unknown' NOT NULL,
	"birth_date" date,
	"acquired_date" date,
	"status" "animal_status_enum" DEFAULT 'active' NOT NULL,
	"flock_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_egg_collection" (
	"id" serial PRIMARY KEY NOT NULL,
	"egg_type_id" integer NOT NULL,
	"flock_id" integer,
	"collection_date" date NOT NULL,
	"count_each" integer NOT NULL,
	"notes" text,
	CONSTRAINT "daily_egg_collection_unique" UNIQUE("egg_type_id","flock_id","collection_date"),
	CONSTRAINT "daily_egg_collection_count_non_negative" CHECK ("daily_egg_collection"."count_each" >= 0)
);
--> statement-breakpoint
CREATE TABLE "egg_inventory_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"egg_type_id" integer NOT NULL,
	"lot_id" integer,
	"qty_each" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "egg_inventory_lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"egg_type_id" integer NOT NULL,
	"source_collection_id" integer,
	"lot_date" date NOT NULL,
	"initial_qty_each" integer NOT NULL,
	"remaining_qty_each" integer NOT NULL,
	"status" "egg_inventory_lot_status" DEFAULT 'open' NOT NULL,
	CONSTRAINT "egg_inventory_lots_initial_non_negative" CHECK ("egg_inventory_lots"."initial_qty_each" >= 0),
	CONSTRAINT "egg_inventory_lots_remaining_non_negative" CHECK ("egg_inventory_lots"."remaining_qty_each" >= 0),
	CONSTRAINT "egg_inventory_lots_remaining_lte_initial" CHECK ("egg_inventory_lots"."remaining_qty_each" <= "egg_inventory_lots"."initial_qty_each")
);
--> statement-breakpoint
CREATE TABLE "egg_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"name" text NOT NULL,
	"flock_id" integer,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flock_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"flock_id" integer NOT NULL,
	"event_type" "flock_event_type" NOT NULL,
	"count" integer NOT NULL,
	"event_date" date NOT NULL,
	"notes" text,
	CONSTRAINT "flock_events_count_positive" CHECK ("flock_events"."count" > 0)
);
--> statement-breakpoint
CREATE TABLE "flocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"name" text NOT NULL,
	"species" "flock_species" NOT NULL,
	"breed" text,
	"acquired_date" date,
	"hatch_date" date,
	"age_months" integer,
	"hen_count" integer,
	"rooster_count" integer,
	"status" "flock_status" DEFAULT 'active' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "inventory_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_item_id" integer NOT NULL,
	"lot_id" integer NOT NULL,
	"allocated_qty_each" integer NOT NULL,
	"allocated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_allocations_unique" UNIQUE("order_item_id","lot_id"),
	CONSTRAINT "inventory_allocations_qty_positive" CHECK ("inventory_allocations"."allocated_qty_each" > 0)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"vendor" text,
	"payment_method" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"code" text NOT NULL,
	"description" text,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"max_redemptions" integer,
	"redemptions_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"stripe_coupon_id" text,
	"stripe_promotion_code_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_page_seo" (
	"page_id" integer PRIMARY KEY NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"canonical_url" text,
	"og_title" text,
	"og_description" text,
	"og_image_url" text,
	"robots" text DEFAULT 'index_follow' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cms_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cms_menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_id" integer NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_menus" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cms_menus_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "farmops_subscription_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"addon_type" "farmops_addon_type" NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"stripe_subscription_item_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farmops_subscription_addons_tenant_id_addon_type_unique" UNIQUE("tenant_id","addon_type")
);
--> statement-breakpoint
CREATE TABLE "farmops_tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"owner_email" text NOT NULL,
	"status" "farmops_tenant_status" DEFAULT 'trialing' NOT NULL,
	"plan" "farmops_plan" DEFAULT 'starter' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_status" text,
	"stripe_price_id" text,
	"trial_ends_at" timestamp with time zone,
	"current_period_ends_at" timestamp with time zone,
	"onboarding_purchased_at" timestamp with time zone,
	"stripe_onboarding_payment_id" text,
	"storefront_enabled" boolean DEFAULT false NOT NULL,
	"created_by_admin_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farmops_tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "farmops_tenants_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "farmops_tenants_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "farmops_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"phone" text,
	"role" "farmops_user_role" DEFAULT 'member' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"verification_token" text,
	"reset_token" text,
	"reset_token_expires_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farmops_users_tenant_id_email_unique" UNIQUE("tenant_id","email")
);
--> statement-breakpoint
CREATE TABLE "farmops_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"email" text NOT NULL,
	"role" "farmops_user_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"invited_by_user_id" integer,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farmops_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"password_reset_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "platform_admin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farmops_sms_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"to_phone" text NOT NULL,
	"body" text NOT NULL,
	"status" "farmops_sms_status" NOT NULL,
	"twilio_sid" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notify_me" ADD CONSTRAINT "notify_me_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preorder_batches" ADD CONSTRAINT "preorder_batches_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preorder_batches" ADD CONSTRAINT "preorder_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_events" ADD CONSTRAINT "pickup_events_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_pickup_event_id_pickup_events_id_fk" FOREIGN KEY ("pickup_event_id") REFERENCES "public"."pickup_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_batch_id_preorder_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."preorder_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickup_event_id_pickup_events_id_fk" FOREIGN KEY ("pickup_event_id") REFERENCES "public"."pickup_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_pending_checkouts" ADD CONSTRAINT "stripe_pending_checkouts_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_pending_checkouts" ADD CONSTRAINT "stripe_pending_checkouts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_pending_checkouts" ADD CONSTRAINT "stripe_pending_checkouts_pickup_event_id_pickup_events_id_fk" FOREIGN KEY ("pickup_event_id") REFERENCES "public"."pickup_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_carts" ADD CONSTRAINT "customer_carts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_flock_id_flocks_id_fk" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_egg_collection" ADD CONSTRAINT "daily_egg_collection_egg_type_id_egg_types_id_fk" FOREIGN KEY ("egg_type_id") REFERENCES "public"."egg_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_egg_collection" ADD CONSTRAINT "daily_egg_collection_flock_id_flocks_id_fk" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_inventory_adjustments" ADD CONSTRAINT "egg_inventory_adjustments_egg_type_id_egg_types_id_fk" FOREIGN KEY ("egg_type_id") REFERENCES "public"."egg_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_inventory_adjustments" ADD CONSTRAINT "egg_inventory_adjustments_lot_id_egg_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."egg_inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_inventory_lots" ADD CONSTRAINT "egg_inventory_lots_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_inventory_lots" ADD CONSTRAINT "egg_inventory_lots_egg_type_id_egg_types_id_fk" FOREIGN KEY ("egg_type_id") REFERENCES "public"."egg_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_inventory_lots" ADD CONSTRAINT "egg_inventory_lots_source_collection_id_daily_egg_collection_id_fk" FOREIGN KEY ("source_collection_id") REFERENCES "public"."daily_egg_collection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_types" ADD CONSTRAINT "egg_types_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_types" ADD CONSTRAINT "egg_types_flock_id_flocks_id_fk" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flock_events" ADD CONSTRAINT "flock_events_flock_id_flocks_id_fk" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flocks" ADD CONSTRAINT "flocks_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_lot_id_egg_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."egg_inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_page_seo" ADD CONSTRAINT "cms_page_seo_page_id_cms_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_menu_items" ADD CONSTRAINT "cms_menu_items_menu_id_cms_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."cms_menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmops_subscription_addons" ADD CONSTRAINT "farmops_subscription_addons_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmops_tenants" ADD CONSTRAINT "farmops_tenants_created_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmops_users" ADD CONSTRAINT "farmops_users_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmops_invitations" ADD CONSTRAINT "farmops_invitations_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmops_invitations" ADD CONSTRAINT "farmops_invitations_invited_by_user_id_farmops_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."farmops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_audit_logs" ADD CONSTRAINT "platform_admin_audit_logs_admin_id_platform_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmops_sms_messages" ADD CONSTRAINT "farmops_sms_messages_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_admin_created" ON "platform_admin_audit_logs" USING btree ("admin_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "platform_admin_audit_logs" USING btree ("created_at");