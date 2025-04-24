import { createRenderJob } from '@/lib/render';
import { renderQueue } from '@/lib/queue';
import { JobsOptions } from 'bullmq'; // Import JobsOptions type
import { NextRequest, NextResponse } from 'next/server';
import { getSessionTeam, getSessionUser } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const user = await getSessionUser();
    const team = await getSessionTeam();
    
    if (!user || !team) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the render parameters from the request body
    const { title, roomType, lighting, inputImageUrl } = await request.json();
    
    if (!title || !roomType || !lighting || !inputImageUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Create the render job
    const job = await createRenderJob({
      teamId: team.id,
      userId: user.id,
      title,
      roomType,
      lighting,
      inputImageUrl,
    });

    // Enqueue the job for background processing with options
  // Define job options with explicit type
  const jobOptions: JobsOptions = {
    timeout: 300000, // 5 minutes in milliseconds
    attempts: 2,     // Allow 1 retry if the job fails
    removeOnComplete: true, // Keep queue clean
    removeOnFail: { count: 100 } // Keep last 100 failed jobs
} as JobsOptions; // Use type assertion

// Enqueue the job for background processing with options
await renderQueue.add(
  'renderJob',   // Job name
  { jobId: job.id }, // Job data
  jobOptions     // Pass the defined options object
);
console.log(`Enqueued job ${job.id} with timeout and retry options.`);
    // Return the job ID immediately
    return NextResponse.json({
      success: true,
      jobId: job.id,
    });
  } catch (error) {
    console.error('Error creating render job:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create render job',
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
