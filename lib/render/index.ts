import { db } from '@/lib/db/drizzle';
import { renderJobs, creditTransactions, teams, RenderStatus, ActivityType } from '@/lib/db/schema';
import { generateRender, type RenderResult } from '@/lib/openai';
import { eq, and } from 'drizzle-orm';
import { logActivity } from '@/lib/db/queries';

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
  console.log(`PROCESS_JOB: Starting processing for job ${job.id}`);
  // Get the render job
  console.log(`PROCESS_JOB: Fetching job ${job.id} details from DB...`);
  const renderJob = await db.query.renderJobs.findFirst({
    where: eq(renderJobs.id, job.id), // Drizzle should handle string UUID comparison
  });

  if (!renderJob) {
    console.error(`PROCESS_JOB: Job ${job.id} not found in DB.`);
    throw new Error('Render job not found');
  }
  console.log(`PROCESS_JOB: Found job ${job.id}. Current status: ${renderJob.status}`);

  if (renderJob.status !== RenderStatus.PENDING) {
    console.warn(`PROCESS_JOB: Job ${job.id} is not PENDING (status: ${renderJob.status}). Aborting processing.`);
    // Don't throw an error here, just return, as the status endpoint might trigger this multiple times.
    return; 
    // throw new Error(`Job is already in ${renderJob.status} state`); // Original line - changed to return
  }

  // Initialize renderResult outside the try block so it's available in catch
  let renderResult: RenderResult | undefined;
  
  try {
    console.log(`PROCESS_JOB: Updating job ${job.id} status to PROCESSING in DB...`);
    // Update job status to processing
    await db
      .update(renderJobs)
      .set({ status: RenderStatus.PROCESSING }) // Removed updatedAt: new Date()
      .where(eq(renderJobs.id, job.id));
    console.log(`PROCESS_JOB: Job ${job.id} status updated to PROCESSING.`);

    // Call OpenAI to generate the render
    console.log(`PROCESS_JOB: Calling generateRender for job ${job.id} (User: ${renderJob.userId}). Input: ${renderJob.inputImagePath}`);
    
    renderResult = await generateRender({
      inputImagePath: renderJob.inputImagePath, // Renamed from collageImagePath
      roomType: renderJob.roomType,
      lighting: renderJob.lighting,
      userId: renderJob.userId.toString(),
    });
    console.log(`PROCESS_JOB: generateRender returned for job ${job.id}. Success: ${renderResult.success}`);

    // Use generatedImageUrl for logging
    // Log more details from the result
    console.log(`PROCESS_JOB: Render result details for ${job.id}: success=${renderResult.success}, generatedImageUrl=${renderResult.generatedImageUrl?.substring(0, 50)}..., prompt=${renderResult.prompt?.substring(0,50)}..., error=${renderResult.error}, uploadError=${renderResult.uploadError}`);

    if (!renderResult.success) {
      // Log full error details
      console.error(`PROCESS_JOB: generateRender failed for job ${job.id}. Error:`, renderResult.error);
      // Throw the error to be caught by the main catch block, which updates the status to FAILED
      throw new Error(renderResult.error || 'Failed to generate render');
    }
    
    // If there's an uploadError but we still have an image URL, log but continue
    if (renderResult.uploadError) {
      console.warn(`PROCESS_JOB: UploadThing error occurred for job ${job.id}, but continuing as image URL exists. Error:`, renderResult.uploadError);
    }

    console.log(`PROCESS_JOB: Render successful for job ${job.id}. Proceeding with credit deduction and final update.`);
    // Get the team to deduct credits
    console.log(`PROCESS_JOB: Fetching team data for team ${renderJob.teamId}...`);
    const teamData = await db.query.teams.findFirst({
      where: eq(teams.id, renderJob.teamId),
    });

    if (!teamData) {
      console.error(`PROCESS_JOB: Team ${renderJob.teamId} not found for job ${job.id}.`);
      throw new Error('Team not found');
    }
    console.log(`PROCESS_JOB: Found team ${renderJob.teamId}. Current credits: ${teamData.credits}`);

    if (teamData.credits < 1) {
      console.error(`PROCESS_JOB: Insufficient credits for team ${renderJob.teamId} (needs 1, has ${teamData.credits}) for job ${job.id}.`);
      // This case should ideally be prevented by the initial check in createRenderJob, but double-check here.
      // Mark job as failed due to credits issue *after* successful render.
      throw new Error('Not enough credits to complete this render (checked after generation)'); 
    }

    // Make sure renderResult and generatedImageUrl are defined (already checked success, but belt-and-suspenders)
    if (!renderResult.generatedImageUrl) {
       console.error(`PROCESS_JOB: Render marked successful for job ${job.id}, but generatedImageUrl is missing!`);
      throw new Error('Render result is missing generatedImageUrl despite success flag');
    }
    console.log(`PROCESS_JOB: Starting DB transaction for job ${job.id} completion...`);

    // Deduct credits and update job in a transaction
    await db.transaction(async (tx) => {
      console.log(`PROCESS_JOB: [TX ${job.id}] Deducting 1 credit from team ${renderJob.teamId}...`);
      // Deduct 1 credit from the team
      await tx
        .update(teams)
        .set({ 
          credits: teamData.credits - 1,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, renderJob.teamId));
      console.log(`PROCESS_JOB: [TX ${job.id}] Credit deducted.`);

      // Create credit transaction record
      console.log(`PROCESS_JOB: [TX ${job.id}] Creating credit transaction record...`);
      await tx.insert(creditTransactions).values({
        teamId: renderJob.teamId,
        userId: renderJob.userId,
        amount: -1,
        description: `Credit used for render: ${renderJob.title}`,
        balanceAfter: teamData.credits - 1,
        renderJobId: renderJob.id,
      });
      console.log(`PROCESS_JOB: [TX ${job.id}] Credit transaction record created.`);

      // Update job with the result
      console.log(`PROCESS_JOB: [TX ${job.id}] Updating render job status to COMPLETED...`);
      await tx
        .update(renderJobs)
        .set({
          status: RenderStatus.COMPLETED,
          // Use generatedImageUrl here
          resultImagePath: renderResult!.generatedImageUrl!, 
          prompt: renderResult!.prompt || '',
          completedAt: new Date(),
          creditDeducted: true, // Flag to indicate credit was deducted
        })
        .where(eq(renderJobs.id, job.id));
      console.log(`PROCESS_JOB: [TX ${job.id}] Render job status updated.`);
    });
    console.log(`PROCESS_JOB: DB transaction for job ${job.id} completed successfully.`);

    // Log completion activity
    console.log(`PROCESS_JOB: Logging completion activity for job ${job.id}...`);
    await logActivity({
      teamId: renderJob.teamId,
      userId: renderJob.userId,
      action: ActivityType.COMPLETE_RENDER,
      ipAddress: '',
    });
    console.log(`PROCESS_JOB: Completion activity logged for job ${job.id}.`);

    console.log(`PROCESS_JOB: Job ${job.id} processed successfully. Returning result.`);
    return {
      success: true,
      jobId: job.id,
      // Return generatedImageUrl
      imageUrl: renderResult.generatedImageUrl, 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`PROCESS_JOB: Error caught during processing of job ${job.id}. Error: ${errorMessage}`, error);
    
    // If we get an error related to UploadThing but have a gpt-image-1 image, still mark as success
    // Check for generatedImageUrl in fallback logic
    if (errorMessage.includes('UploadThing') && renderResult?.generatedImageUrl) { 
      console.warn(`PROCESS_JOB: Handling UploadThing error for job ${job.id} as non-fatal because image URL exists.`);
      
      // Update job as completed anyway, using the generated image URL
      console.log(`PROCESS_JOB: Updating job ${job.id} status to COMPLETED despite UploadThing error...`);
      await db
        .update(renderJobs)
        .set({
          status: RenderStatus.COMPLETED,
          // Use generatedImageUrl here too
          resultImagePath: renderResult.generatedImageUrl, 
          prompt: renderResult.prompt || '',
          completedAt: new Date(),
          errorMessage: `Warning: ${errorMessage} (But image was generated successfully)`,
        })
        .where(eq(renderJobs.id, job.id));
      console.log(`PROCESS_JOB: Job ${job.id} marked as COMPLETED with warning.`);
        
      // Still return success because the core render worked
      return {
        success: true, 
        jobId: job.id,
        // Return generatedImageUrl in fallback
        imageUrl: renderResult.generatedImageUrl, 
      };
    }
    
    // Otherwise update job with error
    console.error(`PROCESS_JOB: Marking job ${job.id} as FAILED due to error: ${errorMessage}`);
    await db
      .update(renderJobs)
      .set({
        status: RenderStatus.FAILED,
        errorMessage: errorMessage,
        completedAt: new Date(), // Mark completion time even for failures
      })
      .where(eq(renderJobs.id, job.id));
    console.log(`PROCESS_JOB: Job ${job.id} status updated to FAILED in DB.`);

    // Re-throw the error so the caller knows something went wrong, 
    // but the job status is already updated.
    // The status endpoint trigger doesn't need to catch this.
    // throw error; // Don't re-throw, let the function complete. The status is updated.
    console.log(`PROCESS_JOB: Exiting processRenderJob for ${job.id} after handling error.`);
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
