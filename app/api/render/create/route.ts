import { createRenderJob } from '@/lib/render'; // Removed processRenderJob
import { renderQueue } from '@/lib/queue'; // Added renderQueue
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

    // Enqueue the job for background processing
    await renderQueue.add('renderJob', { jobId: job.id });
    console.log(`Enqueued job ${job.id} for processing.`);

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
