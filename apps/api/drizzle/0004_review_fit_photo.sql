CREATE TYPE "public"."review_fit" AS ENUM('small', 'true', 'large');--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "fit" "review_fit";--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "photo_url" text;