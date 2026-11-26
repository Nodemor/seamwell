CREATE TYPE "public"."rental_booking_status" AS ENUM('active', 'released');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('none', 'held', 'refunded', 'kept');--> statement-breakpoint
CREATE TYPE "public"."item_mode" AS ENUM('buy', 'rent');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'returned' BEFORE 'cancelled';--> statement-breakpoint
CREATE TABLE "rental_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"quantity" integer NOT NULL,
	"status" "rental_booking_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_bookings_dates" CHECK ("rental_bookings"."end_date" >= "rental_bookings"."start_date"),
	CONSTRAINT "rental_bookings_qty_positive" CHECK ("rental_bookings"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "mode" "item_mode" DEFAULT 'buy' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "event_date" date;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "rent_start" date;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "rent_end" date;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "deposit_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_status" "deposit_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "returned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "rent_stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rent_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rent_price_cents" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rent_deposit_cents" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rent_days" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_price_cents" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rental_bookings_variant_dates_idx" ON "rental_bookings" USING btree ("variant_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "rental_bookings_order_idx" ON "rental_bookings" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_rent_dates" CHECK ("order_items"."mode" = 'buy' or ("order_items"."event_date" is not null and "order_items"."rent_start" is not null and "order_items"."rent_end" is not null));--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_rent_stock_nonneg" CHECK ("product_variants"."rent_stock" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_rent_days_range" CHECK ("products"."rent_days" between 3 and 14);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_rent_price_when_enabled" CHECK (not "products"."rent_enabled" or "products"."rent_price_cents" > 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sale_below_price" CHECK ("products"."sale_price_cents" is null or ("products"."sale_price_cents" > 0 and "products"."sale_price_cents" < "products"."price_cents"));