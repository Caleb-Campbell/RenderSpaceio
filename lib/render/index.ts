import { db } from '@/lib/db/drizzle';
import { renderJobs, creditTransactions, teams, RenderStatus, ActivityType } from '@/lib/db/schema';
// Assume these functions will be created/modified in lib/openai and lib/uploadthing respectively
import { callOpenAI, type OpenAIResult } from '@/lib/openai'; 
import { uploadRenderedImage, type UploadResult } from '@/lib/uploadthing'; 
import { eq, and, sql } from 'drizzle-orm';
import { logActivity } from '@/lib/db/queries';
import { publishToUserChannel } from '@/lib/redis'; // Import Redis publisher

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
 * Executes the full render pipeline for a given job ID.
 * This is intended to be called by the background job worker.
 */
export async function executeRenderPipeline(jobId: string): Promise<{ success: boolean; error?: string }> {
  console.log(`[${jobId}] executeRenderPipeline started.`);
  let renderJob;
  let openAIResult: OpenAIResult | undefined;
  let uploadResult: UploadResult | undefined;
  let finalStatus = RenderStatus.FAILED; // Assume failure unless explicitly set to COMPLETED
  let errorMessage = ''; // Accumulate non-critical errors
  let creditDeducted = false; // Track credit deduction success

  try {
    // 1. Fetch Job Details
    console.log(`[${jobId}] Fetching job details...`);
    renderJob = await db.query.renderJobs.findFirst({
      where: eq(renderJobs.id, jobId),
    });

    if (!renderJob) {
      console.error(`[${jobId}] Job not found in DB.`);
      throw new Error('Render job not found');
    }
    console.log(`[${jobId}] Found job. Current status: ${renderJob.status}`);

    // Check if job is already completed or failed
    if (renderJob.status === RenderStatus.COMPLETED || renderJob.status === RenderStatus.FAILED) {
      console.log(`[${jobId}] Job already in final state (${renderJob.status}). Skipping processing.`);
      return { success: renderJob.status === RenderStatus.COMPLETED, error: renderJob.errorMessage ?? undefined };
    }

    // 2. Update status to PROCESSING
    console.log(`[${jobId}] Updating status to PROCESSING...`);
    await db
      .update(renderJobs)
      .set({ status: RenderStatus.PROCESSING })
      .where(eq(renderJobs.id, jobId));
    console.log(`[${jobId}] Status updated to PROCESSING.`);

    // 3. Call OpenAI
    console.log(`[${jobId}] Calling OpenAI...`);
    openAIResult = await callOpenAI({
      inputImagePath: renderJob.inputImagePath,
      roomType: renderJob.roomType,
      lighting: renderJob.lighting,
      userId: renderJob.userId.toString(),
    });
    console.log(`[${jobId}] OpenAI returned. Success: ${openAIResult.success}`);

    if (!openAIResult.success || !openAIResult.imageData) {
      throw new Error(openAIResult.error || 'Failed to generate render in OpenAI (missing image data)');
    }
    console.log(`[${jobId}] OpenAI generation successful.`);

    // 4. Update status to UPLOADING
    console.log(`[${jobId}] Updating status to UPLOADING...`);
    await db
      .update(renderJobs)
      .set({ status: RenderStatus.UPLOADING })
      .where(eq(renderJobs.id, jobId));
    console.log(`[${jobId}] Status updated to UPLOADING.`);

    // 5. Upload to UploadThing
    console.log(`[${jobId}] Calling UploadThing...`);
    uploadResult = await uploadRenderedImage({
      imageData: openAIResult.imageData,
      // filename: `render_${jobId}.png` // Example: Pass context if needed
    });
    console.log(`[${jobId}] UploadThing returned. Success: ${uploadResult.success}`);

    if (!uploadResult.success || !uploadResult.imageUrl) {
      throw new Error(uploadResult.error || 'Failed to upload rendered image (missing image URL)');
    }
    console.log(`[${jobId}] Upload successful. URL: ${uploadResult.imageUrl}`);

    // --- CRITICAL DB UPDATE ---
    // 6. Update Job to COMPLETED (Primary Success Indicator)
    console.log(`[${jobId}] Attempting final critical update to COMPLETED...`);
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
        .where(eq(renderJobs.id, jobId))
        .returning({ id: renderJobs.id, status: renderJobs.status }); // Verify update

      if (updateResult.length === 0 || updateResult[0].status !== RenderStatus.COMPLETED) {
        throw new Error('Failed to verify final job update to COMPLETED status.');
      }
      finalStatus = RenderStatus.COMPLETED; // Mark as successful
      console.log(`[${jobId}] Critical update to COMPLETED successful.`);
    } catch (dbError) {
      console.error(`[${jobId}] CRITICAL ERROR updating job to COMPLETED:`, dbError);
      // If this critical update fails, the entire job is considered failed.
      // The main catch block will handle setting the FAILED status.
      throw new Error(`Failed final DB update: ${dbError instanceof Error ? dbError.message : dbError}`);
    }

    // --- NON-CRITICAL DB UPDATES (Attempt even if prior non-critical steps failed) ---
    // These run *after* the job is marked COMPLETED. Errors here are logged but don't fail the job.

    // 7. Deduct Credits
    console.log(`[${jobId}] Attempting non-critical credit deduction...`);
    try {
      const teamData = await db.query.teams.findFirst({
        where: eq(teams.id, renderJob.teamId),
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
        console.log(`[${jobId}] Credit deducted successfully.`);
      } else {
        // This could happen if credits dropped below 1 between check and update, or team deleted
        throw new Error('Credit deduction update affected 0 rows.');
      }
    } catch (creditError) {
      const msg = `Failed to deduct credit: ${creditError instanceof Error ? creditError.message : creditError}`;
      console.error(`[${jobId}] NON-CRITICAL ERROR: ${msg}`);
      errorMessage += ` ${msg}`; // Append to error message
    }

    // 8. Log Credit Transaction
    if (creditDeducted) { // Only log if deduction was successful
      console.log(`[${jobId}] Attempting non-critical credit transaction logging...`);
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
          renderJobId: renderJob.id,
        });
        console.log(`[${jobId}] Credit transaction logged successfully.`);
      } catch (creditLogError) {
        const msg = `Failed to log credit transaction: ${creditLogError instanceof Error ? creditLogError.message : creditLogError}`;
        console.error(`[${jobId}] NON-CRITICAL ERROR: ${msg}`);
        errorMessage += ` ${msg}`; // Append to error message
      }
    } else {
        console.log(`[${jobId}] Skipping credit transaction log as deduction failed or was skipped.`);
        if (!errorMessage.includes('Failed to deduct credit')) { // Avoid duplicate message part
             errorMessage += ' Credit deduction skipped or failed.';
        }
    }

    // 9. Log Activity
    console.log(`[${jobId}] Attempting non-critical activity logging...`);
    try {
      await logActivity({
        teamId: renderJob.teamId,
        userId: renderJob.userId,
        action: ActivityType.COMPLETE_RENDER,
        ipAddress: '', // IP address might not be available in worker context
      });
      console.log(`[${jobId}] Activity logged successfully.`);
    } catch (activityError) {
      const msg = `Failed to log activity: ${activityError instanceof Error ? activityError.message : activityError}`;
      console.error(`[${jobId}] NON-CRITICAL ERROR: ${msg}`);
      errorMessage += ` ${msg}`; // Append to error message
    }

    // 10. Final Update for Non-Critical Errors (if any)
    errorMessage = errorMessage.trim(); // Clean up whitespace
    if (errorMessage || !creditDeducted) { // Update if there were errors OR credit deduction failed
      console.log(`[${jobId}] Updating job with non-critical error messages or credit status...`);
      await db
        .update(renderJobs)
        .set({
          errorMessage: errorMessage || null, // Set to null if empty
          creditDeducted: creditDeducted,
        })
        .where(eq(renderJobs.id, jobId));
       console.log(`[${jobId}] Job updated with non-critical info. Error: "${errorMessage}", Credit Deducted: ${creditDeducted}`);
    }

    // --- Publish Completion Event to Redis ---
    if (finalStatus === RenderStatus.COMPLETED) {
      console.log(`[${jobId}] Publishing completion event to Redis channel user-events:${renderJob.userId}...`);
      await publishToUserChannel(renderJob.userId, 'render.completed', {
        jobId: renderJob.id,
        title: renderJob.title,
        status: RenderStatus.COMPLETED,
        resultImageUrl: uploadResult?.imageUrl, // Send the result URL
        // Include any other relevant data for the toast/link
      });
    } else {
       // Publish a 'render.failed' event if the final status is not COMPLETED
       console.log(`[${jobId}] Publishing failure event to Redis channel user-events:${renderJob.userId}...`);
       await publishToUserChannel(renderJob.userId, 'render.failed', {
         jobId: renderJob.id,
         title: renderJob.title,
         status: RenderStatus.FAILED,
         errorMessage: errorMessage || 'Render failed due to an issue before the critical update.', // Use accumulated or default message
       });
    }
    console.log(`[${jobId}] executeRenderPipeline finished successfully.`);
    // The return value here is for the BullMQ worker, not directly used by frontend
    return { success: finalStatus === RenderStatus.COMPLETED, error: errorMessage || undefined };

  } catch (error) {
    // --- MAIN ERROR HANDLING ---
    const criticalErrorMessage = error instanceof Error ? error.message : 'Unknown critical error'; // Declare only once
    console.error(`[${jobId}] CRITICAL ERROR during pipeline execution: ${criticalErrorMessage}`, error);

    // Attempt to update the job status to FAILED, including the error message
    try {
      // Fetch current status again in case it changed during error handling
      const currentStatus = (await db.query.renderJobs.findFirst({
          where: eq(renderJobs.id, jobId),
          columns: { status: true }
      }))?.status;

      // Only update to FAILED if not already COMPLETED (e.g., non-critical error happened after COMPLETED update)
      if (currentStatus !== RenderStatus.COMPLETED) {
          console.log(`[${jobId}] Attempting to mark job as FAILED in DB...`);
          await db
            .update(renderJobs)
            .set({
              status: RenderStatus.FAILED,
              errorMessage: criticalErrorMessage,
              completedAt: new Date(), // Mark completion time even for failures
            })
            .where(eq(renderJobs.id, jobId));
          console.log(`[${jobId}] Job status updated to FAILED.`);
      } else {
          console.log(`[${jobId}] Job was already COMPLETED, but a subsequent error occurred: ${criticalErrorMessage}. Not changing status.`);
          // Optionally update just the error message for the completed job
          await db.update(renderJobs)
            .set({ errorMessage: `Completed but error occurred: ${criticalErrorMessage}` })
            .where(eq(renderJobs.id, jobId));
      }
    } catch (dbError) {
      console.error(`[${jobId}] FATAL: Failed to update job status to FAILED after critical error:`, dbError);
      // If we can't even update the status to FAILED, log it prominently.
      // The job might remain stuck in PROCESSING/UPLOADING state in the DB.
    }

    // --- Publish Failure Event from Catch Block ---
    // Attempt to publish even if DB update failed, using original renderJob data if available
    if (renderJob) {
        console.log(`[${jobId}] Publishing failure event (from catch block) to Redis channel user-events:${renderJob.userId}...`);
        await publishToUserChannel(renderJob.userId, 'render.failed', {
            jobId: renderJob.id,
            title: renderJob.title,
            status: RenderStatus.FAILED,
            errorMessage: criticalErrorMessage,
        });
    } else {
        console.error(`[${jobId}] Cannot publish failure event: renderJob data unavailable.`);
    }


    // Return failure from the function for the BullMQ worker
    return { success: false, error: criticalErrorMessage };
  }
}


// --- Helper Type Definitions ---
// These might live in the respective files (openai/index.ts, uploadthing/index.ts)

// export type OpenAIResult = {
//   success: boolean;
//   imageData?: Buffer | string; // Or whatever format OpenAI returns/we process
//   prompt?: string;
//   error?: string;
// };

// export type UploadResult = {
//   success: boolean;
//   imageUrl?: string;
//   error?: string;
// };
// --- End Helper Type Definitions ---

/**
 * Get render jobs for a team
 */
export async function getRenderJobs(teamId: number) {
  return db.query.renderJobs.findMany({
    where: eq(renderJobs.teamId, teamId),
    orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
  });
}

/**
 * Get a specific render job
 */
export async function getRenderJob(jobId: string) { // Changed jobId type to string
  return db.query.renderJobs.findFirst({
    where: eq(renderJobs.id, jobId), // Drizzle should handle string UUID comparison
  });
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
