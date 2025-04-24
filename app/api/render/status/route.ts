import { db } from '@/lib/db/drizzle'; // Import db
import { renderJobs, RenderStatus } from '@/lib/db/schema'; // Import renderJobs schema and RenderStatus enum
import { eq } from 'drizzle-orm'; // Import eq operator
import { getRenderJob, processRenderJob } from '@/lib/render';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
// RenderStatus is already imported from schema

export async function GET(request: NextRequest) {
  // ... (authentication and jobId fetching logic remains the same) ...
  try {
    // Authenticate the request
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the job ID from the query parameters
    const jobId = request.nextUrl.searchParams.get('id');
    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job ID' },
        { status: 400 }
      );
    }

    // Get the render job (jobId is now a UUID string)
    const job = await getRenderJob(jobId); 
    if (!job) {
      return NextResponse.json(
        { error: 'Render job not found' },
        { status: 404 }
      );
    }

    // Check if the user has access to this job
    // In a real application, you would want to check permissions more carefully
    if (job.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to render job' },
        { status: 403 }
       );
     }

    const now = new Date();
    // Use createdAt to track total time since job creation for timeout
    const jobCreatedAtForTimeout = new Date(job.createdAt);
    const timeDiffMinutes = (now.getTime() - jobCreatedAtForTimeout.getTime()) / (1000 * 60);
    const TIMEOUT_MINUTES = 6; // Set timeout threshold (e.g., 6 minutes)

    // Check for timeout if the job is still PENDING or PROCESSING for too long
    if ((job.status === RenderStatus.PROCESSING || job.status === RenderStatus.PENDING) && timeDiffMinutes > TIMEOUT_MINUTES) {
      console.warn(`Render job ${job.id} timed out after ${TIMEOUT_MINUTES} minutes (status: ${job.status}). Marking as failed.`);
      try {
        // Update the job status to FAILED due to timeout
        const [updatedJobResult] = await db.update(renderJobs) // Correctly use db and renderJobs
          .set({
            status: RenderStatus.FAILED,
            errorMessage: `Render timed out after ${TIMEOUT_MINUTES} minutes.`,
            completedAt: now, // Mark completion time as now
          })
          .where(eq(renderJobs.id, job.id)) // Correctly use eq and renderJobs
          .returning(); // Return the updated job data

        // Return the updated (failed) job data
        // Use the result from returning() or fallback to modifying the existing job object
        const finalFailedJob = updatedJobResult || { ...job, status: RenderStatus.FAILED, errorMessage: `Render timed out after ${TIMEOUT_MINUTES} minutes.` };
        return NextResponse.json(finalFailedJob);

      } catch (dbError) {
          console.error(`Failed to update job ${job.id} status to FAILED after timeout:`, dbError);
          // Return the original job data but indicate a timeout occurred if DB update fails
          return NextResponse.json({ ...job, status: RenderStatus.FAILED, errorMessage: `Render timed out, but failed to update status in DB.` });
      }
    }

    // If job is pending, try to trigger processing (original logic)
    if (job.status === RenderStatus.PENDING) {
      const jobCreatedAt = new Date(job.createdAt);
      const timeDiffSeconds = (now.getTime() - jobCreatedAt.getTime()) / 1000;
      if (timeDiffSeconds > 5) {
        console.log(`Triggering processing for pending job ${job.id}`);
        // Process the job in the background - fire and forget
        // Ensure processRenderJob updates 'updatedAt' when it sets status to PROCESSING
        processRenderJob(job).catch(error => {
          // Log errors during the *triggering* of the process, not the process itself
          console.error(`Error triggering background processing for job ${job.id}:`, error);
        });
        // Return the current PENDING status, it will update on next poll
      }
    }

    // Return the current job data (could be PENDING, PROCESSING, COMPLETED, or FAILED by timeout/error)
    return NextResponse.json(job);

  } catch (error) {
    console.error('Error getting render job status:', error);
    return NextResponse.json(
      { error: 'Failed to get render job status' },
      { status: 500 }
    );
  }
}
