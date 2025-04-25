import { db } from '@/lib/db/drizzle';
import { renderJobs, creditTransactions, teams, RenderStatus, ActivityType, RenderJob } from '@/lib/db/schema'; // Added RenderJob type
// Assume these functions will be created/modified in lib/openai and lib/uploadthing respectively
import { callOpenAI, generateEmptyRoom, type OpenAIImageDataResult, type ProcessedImageUrlResult } from '@/lib/openai'; // Updated imports
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
  let renderJob: RenderJob | undefined; // Add type
  let finalOpenAIResult: OpenAIImageDataResult | undefined; // Use the correct type for the final AI result
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

    // 3. Execute AI Steps based on Job Type
    const jobType = job.data.type;
    let creditsToDeduct = 1; // Default for original flow

    if (jobType === 'room-placement') {
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Starting Room Placement flow.`);
      creditsToDeduct = 2; // Set credits for this flow

      if (!job.data.roomPhotoUrl || !job.data.collageImageUrl) {
        throw new Error('Missing roomPhotoUrl or collageImageUrl in job data for room-placement type.');
      }

      // Step 3a: Generate Empty Room
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Calling generateEmptyRoom...`);
      // TODO: Implement actual generateEmptyRoom function in lib/openai
      const emptyRoomResult: ProcessedImageUrlResult = await generateEmptyRoom(job.data.roomPhotoUrl); // Use correct type
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] generateEmptyRoom returned. Success: ${emptyRoomResult.success}`);

      // Check for success and the presence of imageUrl
      if (!emptyRoomResult.success || !emptyRoomResult.imageUrl) {
        throw new Error(emptyRoomResult.error || 'Failed to generate or upload empty room (missing image URL)');
      }
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Empty room generation and upload successful. URL: ${emptyRoomResult.imageUrl}`);
      
      // Save the empty room URL to the database
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Saving empty room URL to DB...`);
      try {
          await db.update(renderJobs)
            .set({ emptyRoomImageUrl: emptyRoomResult.imageUrl })
            .where(eq(renderJobs.id, jobUuid));
          console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Empty room URL saved.`);
      } catch (dbUpdateError) {
          // Log this as a non-critical error, as the main pipeline can continue
          const msg = `Failed to save empty room URL: ${dbUpdateError instanceof Error ? dbUpdateError.message : dbUpdateError}`;
          console.warn(`[Job ${bullJobId} / UUID ${jobUuid}] NON-CRITICAL WARNING: ${msg}`);
          // Optionally append to an overall non-critical error message string if you have one
          errorMessage += ` ${msg}`; // Append to the main error message for final logging
      }
      await job.updateProgress(35); // Optional: slightly adjust progress

      // Step 3b: Place Collage into Empty Room
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Calling AI for placement...`);
      // TODO: Ensure callOpenAI or a new function handles placement correctly,
      // using ONLY emptyRoomResult.imageData as the primary input image.
      // The collage image URL needs to be incorporated into the prompt, as the current
      // callOpenAI function only accepts one input image path/data.
      // TODO: Potentially modify callOpenAI or create a new function if the AI model
      // can accept multiple image inputs (e.g., empty room + collage).
      const placementPrompt = `Take the provided empty room image and place the design elements described in the collage found at ${job.data.collageImageUrl} into it realistically. Maintain the room structure. Room type: ${renderJob.roomType}, Lighting: ${renderJob.lighting}.`;
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Placement prompt (first 100 chars): ${placementPrompt.substring(0,100)}...`);

      // Call callOpenAI, passing the EMPTY room image data as the inputImagePath.
      // The internal prompt generation in callOpenAI might need adjustment,
      // or we might need a way to pass our custom placementPrompt.
      // Call callOpenAI, passing the EMPTY room image URL as the inputImagePath
      // and the custom prompt constructed above.
      finalOpenAIResult = await callOpenAI({
        inputImagePath: emptyRoomResult.imageUrl, // Pass the generated empty room URL
        roomType: renderJob.roomType, // Pass context for potential model use
        lighting: renderJob.lighting, // Pass context for potential model use
        userId: renderJob.userId.toString(),
        customPrompt: placementPrompt // Pass the specific prompt for this step
      });
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Placement AI returned. Success: ${finalOpenAIResult.success}`);

    } else {
      // Original Flow: Collage to Room
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Starting original Collage-to-Room flow.`);
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Calling OpenAI...`);
      finalOpenAIResult = await callOpenAI({
        inputImagePath: renderJob.inputImagePath, // Use the path stored in the DB job
        roomType: renderJob.roomType,
        lighting: renderJob.lighting,
        userId: renderJob.userId.toString(),
      });
      console.log(`[Job ${bullJobId} / UUID ${jobUuid}] OpenAI returned. Success: ${finalOpenAIResult.success}`);
    }

    // Check result from the relevant AI step(s)
    if (!finalOpenAIResult?.success || !finalOpenAIResult?.imageData) {
      throw new Error(finalOpenAIResult?.error || 'Failed to generate final render in OpenAI (missing image data)');
    }
    console.log(`[Job ${bullJobId} / UUID ${jobUuid}] Final AI generation successful.`);
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
      imageData: finalOpenAIResult.imageData, // Use the final result image data
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
          prompt: finalOpenAIResult.prompt, // Use prompt from final AI result
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
      // Check against the correct number of credits for the flow type
      if (teamData.credits < creditsToDeduct) throw new Error(`Insufficient credits for deduction (${creditsToDeduct} required).`);

      const updateResult = await db
        .update(teams)
        .set({
          credits: sql`${teams.credits} - ${creditsToDeduct}`, // Deduct correct amount
          updatedAt: new Date(),
        })
        .where(and(eq(teams.id, renderJob.teamId), sql`${teams.credits} >= ${creditsToDeduct}`)) // Ensure sufficient credits
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
          amount: -creditsToDeduct, // Log correct amount deducted
          description: `Credit used for ${jobType === 'room-placement' ? 'Room Placement' : 'Collage'} render: ${renderJob.title}`, // More specific description
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
