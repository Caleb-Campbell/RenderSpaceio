import { db } from '@/lib/db/drizzle';
import { renderJobs, creditTransactions, teams, RenderStatus, ActivityType } from '@/lib/db/schema';
import { generateRender, type RenderResult } from '@/lib/openai';
import { eq, and, sql } from 'drizzle-orm'; // Import sql
import { logActivity } from '@/lib/db/queries';

/**
 * Helper function to append messages to the debugLog field of a render job.
 */
async function appendDebugLog(jobId: string, message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp}: ${message}\n`;
  try {
    // Use sql.raw to concatenate strings in PostgreSQL
    await db.update(renderJobs)
      .set({ 
        debugLog: sql`${renderJobs.debugLog} || ${logEntry}` 
      })
      .where(eq(renderJobs.id, jobId));
  } catch (error) {
    // Log error to console if DB update fails, but don't crash the main process
    console.error(`DB_LOG_ERROR: Failed to append debug log for job ${jobId}:`, error);
  }
}

/**
 * Create a new render job (without deducting credits until job is successful)
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
 * Process a render job
 */
export async function processRenderJob(job: { id: string }) { // Changed id type to string
  await appendDebugLog(job.id, `Starting processing.`); // Use DB log
  // Get the render job
  await appendDebugLog(job.id, `Fetching job details from DB...`); // Use DB log
  const renderJob = await db.query.renderJobs.findFirst({
    where: eq(renderJobs.id, job.id), // Drizzle should handle string UUID comparison
  });

  if (!renderJob) {
    // Log to console here as we can't update the job if it's not found
    console.error(`PROCESS_JOB_ERROR: Job ${job.id} not found in DB.`); 
    throw new Error('Render job not found');
  }
  await appendDebugLog(job.id, `Found job. Current status: ${renderJob.status}`); // Use DB log

  if (renderJob.status !== RenderStatus.PENDING) {
    await appendDebugLog(job.id, `Job is not PENDING (status: ${renderJob.status}). Aborting processing.`); // Use DB log
    // Don't throw an error here, just return, as the status endpoint might trigger this multiple times.
    return; 
    // throw new Error(`Job is already in ${renderJob.status} state`); // Original line - changed to return
  }

  // Initialize renderResult outside the try block so it's available in catch
  let renderResult: RenderResult | undefined;
  
  try {
    await appendDebugLog(job.id, `Updating job status to PROCESSING in DB...`); // Use DB log
    // Update job status to processing
    await db
      .update(renderJobs)
      .set({ status: RenderStatus.PROCESSING }) // Removed updatedAt: new Date()
      .where(eq(renderJobs.id, job.id));
    await appendDebugLog(job.id, `Job status updated to PROCESSING.`); // Use DB log

    // Call OpenAI to generate the render
    await appendDebugLog(job.id, `Calling generateRender (User: ${renderJob.userId}). Input: ${renderJob.inputImagePath}`); // Use DB log
    
    renderResult = await generateRender({
      inputImagePath: renderJob.inputImagePath, // Renamed from collageImagePath
      roomType: renderJob.roomType,
      lighting: renderJob.lighting,
      userId: renderJob.userId.toString(),
    });
    await appendDebugLog(job.id, `generateRender returned. Success: ${renderResult.success}`); // Use DB log

    // Use generatedImageUrl for logging
    // Log more details from the result
    await appendDebugLog(job.id, `Render result details: success=${renderResult.success}, generatedImageUrl=${renderResult.generatedImageUrl?.substring(0, 50)}..., prompt=${renderResult.prompt?.substring(0,50)}..., error=${renderResult.error}, uploadError=${renderResult.uploadError}`); // Use DB log

    if (!renderResult.success) {
      // Log full error details
      await appendDebugLog(job.id, `generateRender failed. Error: ${renderResult.error}`); // Use DB log
      // Throw the error to be caught by the main catch block, which updates the status to FAILED
      throw new Error(renderResult.error || 'Failed to generate render');
    }
    
    // If there's an uploadError but we still have an image URL, log but continue
    if (renderResult.uploadError) {
      await appendDebugLog(job.id, `UploadThing error occurred, but continuing as image URL exists. Error: ${renderResult.uploadError}`); // Use DB log
    }

    await appendDebugLog(job.id, `Render successful. Proceeding with credit deduction and final update.`); // Use DB log
    // Get the team to deduct credits
    await appendDebugLog(job.id, `Fetching team data for team ${renderJob.teamId}...`); // Use DB log
    const teamData = await db.query.teams.findFirst({
      where: eq(teams.id, renderJob.teamId),
    });

    if (!teamData) {
      await appendDebugLog(job.id, `Team ${renderJob.teamId} not found.`); // Use DB log
      throw new Error('Team not found');
    }
    await appendDebugLog(job.id, `Found team ${renderJob.teamId}. Current credits: ${teamData.credits}`); // Use DB log

    if (teamData.credits < 1) {
      await appendDebugLog(job.id, `Insufficient credits (needs 1, has ${teamData.credits}).`); // Use DB log
      // This case should ideally be prevented by the initial check in createRenderJob, but double-check here.
      // Mark job as failed due to credits issue *after* successful render.
      throw new Error('Not enough credits to complete this render (checked after generation)'); 
    }

    // Make sure renderResult and generatedImageUrl are defined (already checked success, but belt-and-suspenders)
    if (!renderResult.generatedImageUrl) {
       await appendDebugLog(job.id, `Render marked successful, but generatedImageUrl is missing!`); // Use DB log
      throw new Error('Render result is missing generatedImageUrl despite success flag');
    }
    await appendDebugLog(job.id, `Starting DB transaction for job completion...`); // Use DB log

    // Deduct credits and update job in a transaction
    await db.transaction(async (tx) => {
      await appendDebugLog(job.id, `[TX] Deducting 1 credit from team ${renderJob.teamId}...`); // Use DB log
      // Deduct 1 credit from the team
      await tx
        .update(teams)
        .set({ 
          credits: teamData.credits - 1,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, renderJob.teamId));
      await appendDebugLog(job.id, `[TX] Credit deducted.`); // Use DB log

      // Create credit transaction record
      await appendDebugLog(job.id, `[TX] Creating credit transaction record...`); // Use DB log
      await tx.insert(creditTransactions).values({
        teamId: renderJob.teamId,
        userId: renderJob.userId,
        amount: -1,
        description: `Credit used for render: ${renderJob.title}`,
        balanceAfter: teamData.credits - 1,
        renderJobId: renderJob.id,
      });
      await appendDebugLog(job.id, `[TX] Credit transaction record created.`); // Use DB log

      // Update job with the result
      await appendDebugLog(job.id, `[TX] Updating render job status to COMPLETED...`); // Use DB log
      await tx
        .update(renderJobs)
        .set({
          status: RenderStatus.COMPLETED,
          // Use generatedImageUrl here
          resultImagePath: renderResult!.generatedImageUrl!, 
          prompt: renderResult!.prompt || '',
          completedAt: new Date(),
          creditDeducted: true, // Flag to indicate credit was deducted
          // Clear debug log on success? Optional. Keep it for now.
          // debugLog: sql`''` // Reset debug log on success
        })
        .where(eq(renderJobs.id, job.id));
      await appendDebugLog(job.id, `[TX] Render job status updated.`); // Use DB log
    });
    await appendDebugLog(job.id, `DB transaction completed successfully.`); // Use DB log

    // Log completion activity (Keep console log for this system-level activity)
    console.log(`PROCESS_JOB: Logging completion activity for job ${job.id}...`); 
    await logActivity({
      teamId: renderJob.teamId,
      userId: renderJob.userId,
      action: ActivityType.COMPLETE_RENDER,
      ipAddress: '',
    });
    console.log(`PROCESS_JOB: Completion activity logged for job ${job.id}.`);

    await appendDebugLog(job.id, `Job processed successfully. Returning result.`); // Use DB log
    return {
      success: true,
      jobId: job.id,
      // Return generatedImageUrl
      imageUrl: renderResult.generatedImageUrl, 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Log error to both console and DB
    console.error(`PROCESS_JOB_ERROR: Error caught during processing of job ${job.id}. Error: ${errorMessage}`, error);
    await appendDebugLog(job.id, `ERROR caught: ${errorMessage}`); // Use DB log
    
    // If we get an error related to UploadThing but have a gpt-image-1 image, still mark as success
    // Check for generatedImageUrl in fallback logic
    if (errorMessage.includes('UploadThing') && renderResult?.generatedImageUrl) { 
      await appendDebugLog(job.id, `Handling UploadThing error as non-fatal because image URL exists.`); // Use DB log
      
      // Update job as completed anyway, using the generated image URL
      await appendDebugLog(job.id, `Updating job status to COMPLETED despite UploadThing error...`); // Use DB log
      await db
        .update(renderJobs)
        .set({
          status: RenderStatus.COMPLETED,
          // Use generatedImageUrl here too
          resultImagePath: renderResult.generatedImageUrl, 
          prompt: renderResult.prompt || '',
          completedAt: new Date(),
          errorMessage: `Warning: ${errorMessage} (But image was generated successfully)`,
          // Append final status to debug log
          debugLog: sql`${renderJobs.debugLog} || ${new Date().toISOString()}: Marked COMPLETED with warning.\n`
        })
        .where(eq(renderJobs.id, job.id));
      await appendDebugLog(job.id, `Job marked as COMPLETED with warning.`); // Use DB log
        
      // Still return success because the core render worked
      return {
        success: true, 
        jobId: job.id,
        // Return generatedImageUrl in fallback
        imageUrl: renderResult.generatedImageUrl, 
      };
    }
    
    // Otherwise update job with error
    await appendDebugLog(job.id, `Marking job as FAILED due to error: ${errorMessage}`); // Use DB log
    await db
      .update(renderJobs)
      .set({
        status: RenderStatus.FAILED,
        errorMessage: errorMessage,
        completedAt: new Date(), // Mark completion time even for failures
        // Append final status to debug log
        debugLog: sql`${renderJobs.debugLog} || ${new Date().toISOString()}: Marked FAILED.\n`
      })
      .where(eq(renderJobs.id, job.id));
    await appendDebugLog(job.id, `Job status updated to FAILED in DB.`); // Use DB log

    // Re-throw the error so the caller knows something went wrong, 
    // but the job status is already updated.
    // The status endpoint trigger doesn't need to catch this.
    // throw error; // Don't re-throw, let the function complete. The status is updated.
    await appendDebugLog(job.id, `Exiting processRenderJob after handling error.`); // Use DB log
    // Return a failure indicator if needed, though the status update is the main thing
    return { success: false, jobId: job.id, error: errorMessage };
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
