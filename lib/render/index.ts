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
  // Get the render job
  const renderJob = await db.query.renderJobs.findFirst({
    where: eq(renderJobs.id, job.id), // Drizzle should handle string UUID comparison
  });

  if (!renderJob) {
    throw new Error('Render job not found');
  }

  if (renderJob.status !== RenderStatus.PENDING) {
    throw new Error(`Job is already in ${renderJob.status} state`);
  }

  // Initialize renderResult outside the try block so it's available in catch
  let renderResult: RenderResult | undefined;
  
  try {
    // Update job status to processing
    await db
      .update(renderJobs)
      .set({ status: RenderStatus.PROCESSING })
      .where(eq(renderJobs.id, job.id));

    // Call OpenAI to generate the render
    console.log(`Processing render job ${job.id} for user ${renderJob.userId}`);
    
    renderResult = await generateRender({
      inputImagePath: renderJob.inputImagePath, // Renamed from collageImagePath
      roomType: renderJob.roomType,
      lighting: renderJob.lighting,
      userId: renderJob.userId.toString(),
    });

    // Use generatedImageUrl for logging
    console.log(`Render result: success=${renderResult.success}, generatedImageUrl=${renderResult.generatedImageUrl?.substring(0, 30)}...`);

    if (!renderResult.success) {
      // Log full error details
      console.error(`Render job ${job.id} failed:`, renderResult.error);
      throw new Error(renderResult.error || 'Failed to generate render');
    }
    
    // If there's an uploadError but we still have an image URL, log but continue
    if (renderResult.uploadError) {
      console.warn(`UploadThing error for job ${job.id}, but we still have an image URL:`, renderResult.uploadError);
    }

    // Get the team to deduct credits
    const teamData = await db.query.teams.findFirst({
      where: eq(teams.id, renderJob.teamId),
    });

    if (!teamData) {
      throw new Error('Team not found');
    }

    if (teamData.credits < 1) {
      throw new Error('Not enough credits to complete this render');
    }

    // Make sure renderResult and generatedImageUrl are defined
    if (!renderResult || !renderResult.generatedImageUrl) {
      throw new Error('Render result is missing or incomplete (generatedImageUrl)');
    }

    // Deduct credits and update job in a transaction
    await db.transaction(async (tx) => {
      // Deduct 1 credit from the team
      await tx
        .update(teams)
        .set({ 
          credits: teamData.credits - 1,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, renderJob.teamId));

      // Create credit transaction record
      await tx.insert(creditTransactions).values({
        teamId: renderJob.teamId,
        userId: renderJob.userId,
        amount: -1,
        description: `Credit used for render: ${renderJob.title}`,
        balanceAfter: teamData.credits - 1,
        renderJobId: renderJob.id,
      });

      // Update job with the result
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
    });

    // Log completion activity
    await logActivity({
      teamId: renderJob.teamId,
      userId: renderJob.userId,
      action: ActivityType.COMPLETE_RENDER,
      ipAddress: '',
    });

    return {
      success: true,
      jobId: job.id,
      // Return generatedImageUrl
      imageUrl: renderResult.generatedImageUrl, 
    };
  } catch (error) {
    console.error(`Error processing render job ${job.id}:`, error);
    
    // If we get an error related to UploadThing but have a gpt-image-1 image, still mark as success
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for generatedImageUrl in fallback logic
    if (errorMessage.includes('UploadThing') && renderResult?.generatedImageUrl) { 
      console.log('UploadThing error but we have a valid generated image URL, marking as success');
      
      // Update job as completed anyway, using the generated image URL
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
        
      return {
        success: true,
        jobId: job.id,
        // Return generatedImageUrl in fallback
        imageUrl: renderResult.generatedImageUrl, 
      };
    }
    
    // Otherwise update job with error
    await db
      .update(renderJobs)
      .set({
        status: RenderStatus.FAILED,
        errorMessage: errorMessage,
      })
      .where(eq(renderJobs.id, job.id));

    throw error;
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
