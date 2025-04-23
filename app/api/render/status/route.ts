import { getRenderJob, processRenderJob } from '@/lib/render';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { RenderStatus } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
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

    // If job is pending, try to process it if it's been more than 5 seconds since creation
    // This is to ensure we don't start processing jobs that are already being processed
    if (job.status === RenderStatus.PENDING) {
      const now = new Date();
      const jobCreatedAt = new Date(job.createdAt);
      const timeDiffSeconds = (now.getTime() - jobCreatedAt.getTime()) / 1000;
      
      if (timeDiffSeconds > 5) {
        // Process the job in the background
        processRenderJob(job).catch(error => {
          console.error('Error processing render job:', error);
        });
      }
    }

    // Return the job data
    return NextResponse.json(job);
  } catch (error) {
    console.error('Error getting render job status:', error);
    return NextResponse.json(
      { error: 'Failed to get render job status' },
      { status: 500 }
    );
  }
}
