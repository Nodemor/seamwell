CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(40) NOT NULL,
	"line1" varchar(120) NOT NULL,
	"line2" varchar(120),
	"city" varchar(60) NOT NULL,
	"district" varchar(60) NOT NULL,
	"postal_code" varchar(10),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_one_default_per_user_uq" ON "addresses" USING btree ("user_id") WHERE "addresses"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_uq" ON "orders" USING btree ("idempotency_key");