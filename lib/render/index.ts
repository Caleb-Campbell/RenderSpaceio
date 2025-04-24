import { db } from '@/lib/db/drizzle';
import { renderJobs, creditTransactions, teams, RenderStatus, ActivityType } from '@/lib/db/schema';
// Assume these functions will be created/modified in lib/openai and lib/uploadthing respectively
import { callOpenAI, type OpenAIResult } from '@/lib/openai'; 
import { uploadRenderedImage, type UploadResult } from '@/lib/uploadthing'; 
import { eq, and, sql } from 'drizzle-orm';
import { logActivity } from '@/lib/db/queries';
import { publishToUserChannel } from '@/lib/redis'; // Import Redis publisher
import { Job } from 'bullmq'; // Import Job type
import { RenderJobData } from '@/lib/queue'; // Import the job data interface

// Removed appendDebugLog helper function

/**
 * Create a new render job (sets status to PENDING)
 */
export async function createRenderJob({
  teamId,
  userId,
  title,
  roomType,
  lighting,
  inputImageUrl, // Renamed from collageImageUrl
}: {
  teamId: number;
  userId: number;
  title: string;
  roomType: string;
  lighting: string;
  inputImageUrl: string; // Renamed from collageImageUrl
}) {
  // First check if the team has enough credits
  const teamData = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  });

  if (!teamData || teamData.credits < 1) {
    throw new Error('Not enough credits to create a render.');
  }

  // Create the render job without deducting credits yet
  const result = await db.transaction(async (tx) => {
    // Create the render job
    const [newRenderJob] = await tx.insert(renderJobs).values({
      teamId,
      userId,
      title,
      roomType,
      lighting,
      status: RenderStatus.PENDING,
      inputImagePath: inputImageUrl, // Renamed from collageImagePath
      createdAt: new Date(), // Set timestamp from app server
    }).returning();

    // Log the activity
    await logActivity({
      teamId,
      userId,
      action: ActivityType.CREATE_RENDER,
      ipAddress: '',
    });

    return newRenderJob;
  });

  return result;
}

/**
 * Executes the full render pipeline for a given job.
 * This is intended to be called by the background job worker.
 */
// Update function signature to accept the full job object
export async function executeRenderPipeline(job: Job<RenderJobData>): Promise<{ success: boolean; error?: string }> {
  const jobUuid = job.data.jobId; // Use the UUID from the job data
  const bullJobId = job.id; // Keep the BullMQ job ID for logging if needed
  // Ensure jobUuid is defined before proceeding
  if (!jobUuid) {
    console.error(`[Job ${bullJobId}] executeRenderPipeline called without a jobUuid in job.data.`);
    // Throw error immediately if the crucial ID is missing
    throw new Error('Job UUID (job.data.jobId) is missing');
  }
  // Ensure bullJobId is defined before proceeding (should always be the case for an active job)
  if (!bullJobId) {
    console.error(`[Job UUID ${jobUuid}] executeRenderPipeline called without a BullMQ job ID (job.id).`);
    // Consider if this case is possible and how to handle, maybe throw?
    // For now, log and continue, but this indicates a potential issue with BullMQ itself.
  }
  console.log(`[Job ${bullJobId} / UUID ${jobUuid}] executeRenderPipeline started.`);
  let renderJob;
  let openAIResult: OpenAIResult | undefined;
  let uploadResult: UploadResult | undefined;
  let finalStatus = RenderStatus.FAILED; // Assume failure unless explicitly set to COMPLETED
  let errorMessage = ''; // Accumulate non-critical errors
  let creditDeducted = false; // Track credit deduction success

  try {
    // 1. Fetch Job Details using the correct UUID
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Fetching job details...`);
    renderJob = await db.query.renderJobs.findFirst({
      where: eq(renderJobs.id, jobUuid), // Use jobUuid here
    });

    if (!renderJob) {
      console.error(`[Job ${bullJobId} / UUID ${jobUuid}] Job not found in DB.`);
      // It's possible the job was deleted between creation and processing
      throw new Error(`Render job with UUID ${jobUuid} not found`);
    }
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Found job. Current status: ${renderJob.status}`);
    await job.updateProgress(10); // Correct method: updateProgress

    // Check if job is already completed or failed
    if (renderJob.status === RenderStatus.COMPLETED || renderJob.status === RenderStatus.FAILED) {
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Job already in final state (${renderJob.status}). Skipping processing.`);
      return { success: renderJob.status === RenderStatus.COMPLETED, error: renderJob.errorMessage ?? undefined };
    }

    // 2. Update status to PROCESSING using the correct UUID
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Updating status to PROCESSING...`);
    await db
      .update(renderJobs)
      .set({ status: RenderStatus.PROCESSING })
      .where(eq(renderJobs.id, jobUuid)); // Use jobUuid here
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Status updated to PROCESSING.`);

    // 3. Call OpenAI
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Calling OpenAI...`);
    openAIResult = await callOpenAI({
      inputImagePath: renderJob.inputImagePath,
      roomType: renderJob.roomType,
      lighting: renderJob.lighting,
      userId: renderJob.userId.toString(),
    });
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] OpenAI returned. Success: ${openAIResult.success}`);

    if (!openAIResult.success || !openAIResult.imageData) {
      throw new Error(openAIResult.error || 'Failed to generate render in OpenAI (missing image data)');
    }
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] OpenAI generation successful.`);
    await job.updateProgress(50); // Correct method: updateProgress

    // 4. Update status to UPLOADING using the correct UUID
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Updating status to UPLOADING...`);
    await db
      .update(renderJobs)
      .set({ status: RenderStatus.UPLOADING })
      .where(eq(renderJobs.id, jobUuid)); // Use jobUuid here
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Status updated to UPLOADING.`);

    // 5. Upload to UploadThing
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Calling UploadThing...`);
    uploadResult = await uploadRenderedImage({
      imageData: openAIResult.imageData,
      // filename: `render_${jobUuid}.png` // Example: Pass context if needed
    });
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] UploadThing returned. Success: ${uploadResult.success}`);

    if (!uploadResult.success || !uploadResult.imageUrl) {
      throw new Error(uploadResult.error || 'Failed to upload rendered image (missing image URL)');
    }
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Upload successful. URL: ${uploadResult.imageUrl}`);
    await job.updateProgress(80); // Correct method: updateProgress

    // --- CRITICAL DB UPDATE ---
    // 6. Update Job to COMPLETED (Primary Success Indicator) using the correct UUID
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Attempting final critical update to COMPLETED...`);
    try {
      const updateResult = await db
        .update(renderJobs)
        .set({
          status: RenderStatus.COMPLETED,
          resultImagePath: uploadResult.imageUrl,
          prompt: openAIResult.prompt,
          completedAt: new Date(),
          // errorMessage will be updated later if non-critical steps fail
        })
        .where(eq(renderJobs.id, jobUuid)) // Use jobUuid here
        .returning({ id: renderJobs.id, status: renderJobs.status }); // Verify update

      if (updateResult.length === 0 || updateResult[0].status !== RenderStatus.COMPLETED) {
        throw new Error(`Failed to verify final job update to COMPLETED status for UUID ${jobUuid}.`);
      }
      finalStatus = RenderStatus.COMPLETED; // Mark as successful
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Critical update to COMPLETED successful.`);
    } catch (dbError) {
      console.error(`[Job ${bullJobId} / UUID ${jobUuid}] CRITICAL ERROR updating job to COMPLETED:`, dbError);
      // If this critical update fails, the entire job is considered failed.
      // The main catch block will handle setting the FAILED status.
      throw new Error(`Failed final DB update: ${dbError instanceof Error ? dbError.message : dbError}`);
    }

    // --- NON-CRITICAL DB UPDATES (Attempt even if prior non-critical steps failed) ---
    // These run *after* the job is marked COMPLETED. Errors here are logged but don't fail the job.

    // 7. Deduct Credits
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Attempting non-critical credit deduction...`);
    try {
      // Fetch team data using renderJob.teamId (which should be correct if renderJob was fetched successfully)
      const teamData = await db.query.teams.findFirst({
        where: eq(teams.id, renderJob.teamId), // This uses the teamId from the fetched job, which is correct
        columns: { credits: true }
      });
      if (!teamData) throw new Error('Team not found for credit deduction.');
      if (teamData.credits < 1) throw new Error('Insufficient credits for deduction.');

      const updateResult = await db
        .update(teams)
        .set({
          credits: sql`${teams.credits} - 1`, // Use SQL expression for atomic update
          updatedAt: new Date(),
        })
        .where(and(eq(teams.id, renderJob.teamId), sql`${teams.credits} >= 1`)) // Ensure credits >= 1
        .returning({ id: teams.id });

      if (updateResult.length > 0) {
        creditDeducted = true;
        console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Credit deducted successfully.`);
      } else {
        // This could happen if credits dropped below 1 between check and update, or team deleted
        throw new Error(`Credit deduction update affected 0 rows for team ${renderJob.teamId}.`);
      }
    } catch (creditError) {
      const msg = `Failed to deduct credit: ${creditError instanceof Error ? creditError.message : creditError}`;
      console.error(`[Job ${bullJobId} / UUID ${jobUuid}] NON-CRITICAL ERROR: ${msg}`);
      errorMessage += ` ${msg}`; // Append to error message
    }

    // 8. Log Credit Transaction
    if (creditDeducted) { // Only log if deduction was successful
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Attempting non-critical credit transaction logging...`);
      try {
        // Fetch balance *after* potential deduction for logging
         const teamDataAfterDeduct = await db.query.teams.findFirst({
            where: eq(teams.id, renderJob.teamId),
            columns: { credits: true }
         });
         const balanceAfter = teamDataAfterDeduct?.credits ?? 0; // Fallback if team fetch fails

        await db.insert(creditTransactions).values({
          teamId: renderJob.teamId,
          userId: renderJob.userId,
          amount: -1,
          description: `Credit used for render: ${renderJob.title}`,
          balanceAfter: balanceAfter,
          renderJobId: renderJob.id, // Use the UUID from the fetched renderJob object
        });
        console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Credit transaction logged successfully.`);
      } catch (creditLogError) {
        const msg = `Failed to log credit transaction: ${creditLogError instanceof Error ? creditLogError.message : creditLogError}`;
        console.error(`[Job ${bullJobId} / UUID ${jobUuid}] NON-CRITICAL ERROR: ${msg}`);
        errorMessage += ` ${msg}`; // Append to error message
      }
    } else {
        console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Skipping credit transaction log as deduction failed or was skipped.`);
        if (!errorMessage.includes('Failed to deduct credit')) { // Avoid duplicate message part
             errorMessage += ' Credit deduction skipped or failed.';
        }
    }

    // 9. Log Activity
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Attempting non-critical activity logging...`);
    try {
      await logActivity({
        teamId: renderJob.teamId,
        userId: renderJob.userId,
        action: ActivityType.COMPLETE_RENDER,
        ipAddress: '', // IP address might not be available in worker context
      });
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Activity logged successfully.`);
    } catch (activityError) {
      const msg = `Failed to log activity: ${activityError instanceof Error ? activityError.message : activityError}`;
      console.error(`[Job ${bullJobId} / UUID ${jobUuid}] NON-CRITICAL ERROR: ${msg}`);
      errorMessage += ` ${msg}`; // Append to error message
    }

    // 10. Final Update for Non-Critical Errors (if any) using the correct UUID
    errorMessage = errorMessage.trim(); // Clean up whitespace
    if (errorMessage || !creditDeducted) { // Update if there were errors OR credit deduction failed
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Updating job with non-critical error messages or credit status...`);
      await db
        .update(renderJobs)
        .set({
          errorMessage: errorMessage || null, // Set to null if empty
          creditDeducted: creditDeducted,
        })
        .where(eq(renderJobs.id, jobUuid)); // Use jobUuid here
       console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Job updated with non-critical info. Error: "${errorMessage}", Credit Deducted: ${creditDeducted}`);
    }

    // --- Publish Completion Event to Redis ---
    if (finalStatus === RenderStatus.COMPLETED) {
      await job.updateProgress(100); // Correct method: updateProgress
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Publishing completion event to Redis channel user-events:${renderJob.userId}...`);
      await publishToUserChannel(renderJob.userId, 'render.completed', {
        jobId: renderJob.id, // Use the UUID from the fetched renderJob object
        title: renderJob.title,
        status: RenderStatus.COMPLETED,
        resultImageUrl: uploadResult?.imageUrl, // Send the result URL
        // Include any other relevant data for the toast/link
      });
    } else {
       // Publish a 'render.failed' event if the final status is not COMPLETED
       console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Publishing failure event to Redis channel user-events:${renderJob.userId}...`);
       await publishToUserChannel(renderJob.userId, 'render.failed', {
         jobId: renderJob.id, // Use the UUID from the fetched renderJob object
         title: renderJob.title,
         status: RenderStatus.FAILED,
         errorMessage: errorMessage || 'Render failed due to an issue before the critical update.', // Use accumulated or default message
       });
    }
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] executeRenderPipeline finished successfully.`);
    // The return value here is for the BullMQ worker, not directly used by frontend
    return { success: finalStatus === RenderStatus.COMPLETED, error: errorMessage || undefined };

  } catch (error) {
    // --- MAIN ERROR HANDLING ---
    const criticalErrorMessage = error instanceof Error ? error.message : 'Unknown critical error'; // Declare only once
    console.error(`[Job ${bullJobId} / UUID ${jobUuid}] CRITICAL ERROR during pipeline execution: ${criticalErrorMessage}`, error);

    // Attempt to update the job status to FAILED, including the error message, using the correct UUID
    try {
      // Fetch current status again in case it changed during error handling
      const currentStatus = (await db.query.renderJobs.findFirst({
          where: eq(renderJobs.id, jobUuid), // Use jobUuid here
          columns: { status: true }
      }))?.status;

      // Only update to FAILED if not already COMPLETED (e.g., non-critical error happened after COMPLETED update)
      if (currentStatus !== RenderStatus.COMPLETED) {
          console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Attempting to mark job as FAILED in DB...`);
          await db
            .update(renderJobs)
            .set({
              status: RenderStatus.FAILED,
              errorMessage: criticalErrorMessage,
              completedAt: new Date(), // Mark completion time even for failures
            })
            .where(eq(renderJobs.id, jobUuid)); // Use jobUuid here
          console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Job status updated to FAILED.`);
      } else {
          console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Job was already COMPLETED, but a subsequent error occurred: ${criticalErrorMessage}. Not changing status.`);
          // Optionally update just the error message for the completed job
          await db.update(renderJobs)
            .set({ errorMessage: `Completed but error occurred: ${criticalErrorMessage}` })
            .where(eq(renderJobs.id, jobUuid)); // Use jobUuid here
      }
    } catch (dbError) {
      console.error(`[Job ${bullJobId} / UUID ${jobUuid}] FATAL: Failed to update job status to FAILED after critical error:`, dbError);
      // If we can't even update the status to FAILED, log it prominently.
      // The job might remain stuck in PROCESSING/UPLOADING state in the DB.
    }

    // --- Publish Failure Event from Catch Block ---
    // Attempt to publish even if DB update failed, using original renderJob data if available
    if (renderJob) { // renderJob might be undefined if the initial fetch failed
        console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Publishing failure event (from catch block) to Redis channel user-events:${renderJob.userId}...`);
        await publishToUserChannel(renderJob.userId, 'render.failed', {
            jobId: renderJob.id, // Use the UUID from the fetched renderJob object
            title: renderJob.title,
            status: RenderStatus.FAILED,
            errorMessage: criticalErrorMessage, // The error that caused the catch block
        });
    } else {
        // If renderJob is unavailable, we might not have userId. We could potentially decode it from jobUuid if it contains it, or just log.
        console.error(`[Job ${bullJobId} / UUID ${jobUuid}] Cannot publish failure event: renderJob data unavailable (initial fetch likely failed).`);
        // Optionally, try publishing without user-specific channel if possible/needed
    }


    // Return failure from the function for the BullMQ worker
    return { success: false, error: criticalErrorMessage };
  }
}

/**
 * Add credits to a team
 */
export async function addCredits({
  teamId,
  userId,
  amount,
  description,
  paymentId,
}: {
  teamId: number;
  userId: number;
  amount: number;
  description: string;
  paymentId?: string;
}) {
  // Get current credit balance
  const teamData = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  });

  if (!teamData) {
    throw new Error('Team not found');
  }

  const newBalance = teamData.credits + amount;

  // Create a transaction
  const result = await db.transaction(async (tx) => {
    // Update team credits
    await tx
      .update(teams)
      .set({ 
        credits: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));

    // Create credit transaction record
    const [transaction] = await tx.insert(creditTransactions).values({
      teamId,
      userId,
      amount,
      description,
      balanceAfter: newBalance,
      stripePaymentId: paymentId,
    }).returning();

    // Log the activity
    await logActivity({
      teamId,
      userId,
      action: ActivityType.PURCHASE_CREDITS,
      ipAddress: '',
    });

    return transaction;
  });

  return result;
}

/**
 * Get credit transactions for a team
 */
export async function getCreditTransactions(teamId: number) {
  return db.query.creditTransactions.findMany({
    where: eq(creditTransactions.teamId, teamId),
    orderBy: (txs, { desc }) => [desc(txs.createdAt)],
  });
}
