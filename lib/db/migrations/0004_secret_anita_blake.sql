-- Drop the existing foreign key constraint
ALTER TABLE "credit_transactions" DROP CONSTRAINT IF EXISTS "credit_transactions_render_job_id_render_jobs_id_fk"; --> statement-breakpoint

-- Drop the old default value for render_jobs.id (sequence)
ALTER TABLE "render_jobs" ALTER COLUMN "id" DROP DEFAULT; --> statement-breakpoint

-- Alter the primary key column in render_jobs to UUID
-- Note: Using gen_random_uuid() in USING clause will assign NEW UUIDs, breaking existing relations if not handled carefully.
ALTER TABLE "render_jobs" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid(); --> statement-breakpoint

-- Set the new default value for render_jobs.id
ALTER TABLE "render_jobs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid(); --> statement-breakpoint

-- Alter the foreign key column in credit_transactions
-- Setting existing FKs to NULL as there's no direct mapping from old INT IDs to new UUIDs.
-- This WILL break existing relationships. A proper data migration is needed for production.
ALTER TABLE "credit_transactions" ALTER COLUMN "render_job_id" SET DATA TYPE uuid USING NULL; --> statement-breakpoint

-- Re-add the foreign key constraint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_render_job_id_render_jobs_id_fk" FOREIGN KEY ("render_job_id") REFERENCES "render_jobs"("id") ON DELETE no action ON UPDATE no action; --> statement-breakpoint
