CREATE TYPE "public"."popup_market_request_status" AS ENUM('new', 'in_review', 'confirmed', 'declined');--> statement-breakpoint
CREATE TABLE "popup_market_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"organization" text,
	"event_location" text NOT NULL,
	"preferred_date" date,
	"alternate_date" date,
	"estimated_attendees" text,
	"event_type" text,
	"products_interested" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"status" "popup_market_request_status" DEFAULT 'new' NOT NULL,
	"admin_notes" text
);
--> statement-breakpoint
ALTER TABLE "coupons" DROP CONSTRAINT "coupons_code_unique";--> statement-breakpoint
ALTER TABLE "cms_pages" DROP CONSTRAINT "cms_pages_slug_unique";--> statement-breakpoint
ALTER TABLE "cms_menus" DROP CONSTRAINT "cms_menus_name_unique";--> statement-breakpoint
ALTER TABLE "cms_pages" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "cms_menus" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "farmops_tenants" ADD COLUMN "logo_object_key" text;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_menus" ADD CONSTRAINT "cms_menus_tenant_id_farmops_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."farmops_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_code_tenant_unique" UNIQUE("code","tenant_id");