ALTER TABLE "render_jobs" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD COLUMN "empty_room_image_url" text;
