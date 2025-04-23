import { getSessionUser, getSessionTeam } from '@/lib/auth/session';
import { createRenderJob, processRenderJob } from '@/lib/render';
import { NextRequest, NextResponse } from 'next/server';

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

    // Start processing the job
    processRenderJob(job).catch(error => {
      console.error('Error processing render job:', error);
    });

    // Return the job ID
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
