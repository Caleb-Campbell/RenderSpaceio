import { db } from '@/lib/db/drizzle'; // Import db
import { renderJobs, RenderStatus } from '@/lib/db/schema'; // Import renderJobs schema and RenderStatus enum
import { eq } from 'drizzle-orm'; // Import eq operator
import { getRenderJob } from '@/lib/render'; // Removed processRenderJob import
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
// RenderStatus is already imported from schema

export async function GET(request: NextRequest) {
  console.log("API: /api/render/status GET request received.");
  try {
    console.log("API: Authenticating user...");
    // Authenticate the request
    const user = await getSessionUser();
    if (!user) {
      console.error("API: Authentication failed - Unauthorized.");
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log(`API: User authenticated: ${user.id}`);

    // Get the job ID from the query parameters
    const jobId = request.nextUrl.searchParams.get('id');
    console.log(`API: Requested Job ID: ${jobId}`);
    if (!jobId) {
      console.error("API: Missing job ID in request.");
      return NextResponse.json(
        { error: 'Missing job ID' },
        { status: 400 }
      );
    }

    // Get the render job (jobId is now a UUID string)
    console.log(`API: Fetching render job ${jobId} from DB...`);
    const job = await getRenderJob(jobId); 
    if (!job) {
      console.error(`API: Render job ${jobId} not found.`);
      return NextResponse.json(
        { error: 'Render job not found' },
        { status: 404 }
      );
    }
    console.log(`API: Found job ${jobId}, Status: ${job.status}, User: ${job.userId}`);

    // Check if the user has access to this job
    console.log(`API: Checking permissions for user ${user.id} on job ${jobId}...`);
    if (job.userId !== user.id) {
      console.error(`API: Unauthorized access attempt by user ${user.id} on job ${jobId} owned by ${job.userId}.`);
      return NextResponse.json(
        { error: 'Unauthorized access to render job' },
        { status: 403 }
       );
     }
    console.log(`API: Permissions check passed for user ${user.id}.`);

    const now = new Date();
    // Use createdAt to track total time since job creation for timeout
    const jobCreatedAtForTimeout = new Date(job.createdAt);
    const timeDiffMinutes = (now.getTime() - jobCreatedAtForTimeout.getTime()) / (1000 * 60);
    const TIMEOUT_MINUTES = 6; // Set timeout threshold (e.g., 6 minutes)

    console.log(`API: Checking for timeout for job ${jobId}. Current time diff: ${timeDiffMinutes} mins.`);
    // Check for timeout if the job is still PENDING or PROCESSING for too long
    if ((job.status === RenderStatus.PROCESSING || job.status === RenderStatus.PENDING) && timeDiffMinutes > TIMEOUT_MINUTES) {
      console.warn(`API: Render job ${job.id} timed out after ${TIMEOUT_MINUTES} minutes (status: ${job.status}). Marking as failed.`);
      try {
        console.log(`API: Attempting to update job ${job.id} status to FAILED in DB due to timeout...`);
        // Update the job status to FAILED due to timeout
        const [updatedJobResult] = await db.update(renderJobs) // Correctly use db and renderJobs
          .set({
            status: RenderStatus.FAILED,
            errorMessage: `Render timed out after ${TIMEOUT_MINUTES} minutes.`,
            completedAt: now, // Mark completion time as now
          })
          .where(eq(renderJobs.id, job.id)) // Correctly use eq and renderJobs
          .returning(); // Return the updated job data
        console.log(`API: Successfully updated job ${job.id} status to FAILED in DB.`);

        // Return the updated (failed) job data
        // Use the result from returning() or fallback to modifying the existing job object
        const finalFailedJob = updatedJobResult || { ...job, status: RenderStatus.FAILED, errorMessage: `Render timed out after ${TIMEOUT_MINUTES} minutes.` };
        console.log(`API: Returning timed-out job data for ${job.id}.`);
        return NextResponse.json(finalFailedJob);

      } catch (dbError) {
          console.error(`API: DB Error - Failed to update job ${job.id} status to FAILED after timeout:`, dbError);
          // Return the original job data but indicate a timeout occurred if DB update fails
          console.log(`API: Returning original job data for ${job.id} but indicating timeout failure.`);
          return NextResponse.json({ ...job, status: RenderStatus.FAILED, errorMessage: `Render timed out, but failed to update status in DB.` });
      }
    } else {
      console.log(`API: Job ${jobId} not timed out.`);
    }

    // Removed the logic that attempted to re-trigger PENDING jobs from the status endpoint.
    // The worker is now solely responsible for processing queued jobs.

    // Return the current job data (could be PENDING, PROCESSING, COMPLETED, or FAILED by timeout/error)
    console.log(`API: Returning current job data for ${job.id}. Status: ${job.status}`);
    return NextResponse.json(job);

  } catch (error) {
    console.error('API: Uncaught error in /api/render/status GET handler:', error);
    return NextResponse.json(
      { error: 'Failed to get render job status' },
      { status: 500 }
    );
  }
}
