import { NextResponse } from 'next/server';
import { getSessionUser, getSessionTeam } from '@/lib/auth/session';
import { createRenderJob } from '@/lib/render'; // Import the actual function
import { renderQueue } from '@/lib/queue'; // Import the queue
import { JobsOptions } from 'bullmq'; // Import JobsOptions type
// import { checkCredits, deductCredits } from '@/lib/payments/actions'; // Placeholder
// import { placeCollageInRoom, generateEmptyRoom } from '@/lib/openai'; // Placeholder for AI logic
import { RenderJob } from '@/lib/db/schema'; // Assuming schema exists

interface PlaceCollageRequestBody {
  roomPhotoUrl: string; // Changed from emptyRoomUrl
  collageImageUrl: string;
  title: string;
  roomType: string;
  lighting: string;
}

export async function POST(request: Request) {
  try {
    // 1. Authentication
    const user = await getSessionUser();
    const team = await getSessionTeam();

    if (!user || !team) {
      return NextResponse.json({ error: 'Unauthorized: No active session or team found.' }, { status: 401 });
    }
    const userId = user.id;
    const teamId = team.id;

    // 2. Parse and Validate Request Body
    const body: PlaceCollageRequestBody = await request.json();
    const { roomPhotoUrl, collageImageUrl, title, roomType, lighting } = body; // Use roomPhotoUrl

    if (!roomPhotoUrl || typeof roomPhotoUrl !== 'string') { // Validate roomPhotoUrl
      return NextResponse.json({ error: 'Missing or invalid roomPhotoUrl' }, { status: 400 });
    }
    if (!collageImageUrl || typeof collageImageUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid collageImageUrl' }, { status: 400 });
    }
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid title' }, { status: 400 });
    }
    if (!roomType || typeof roomType !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid roomType' }, { status: 400 });
    }
    if (!lighting || typeof lighting !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid lighting' }, { status: 400 });
    }

    // 3. Check Credits (Requires 2 credits)
    const requiredCredits = 2;
    // const hasEnoughCredits = await checkCredits(teamId, requiredCredits);
    // if (!hasEnoughCredits) {
    //   return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    // }
    console.log(`[API /place-collage] User ${userId} in team ${teamId} requested placement. Credit check skipped (mock).`);

    // 4. Create Render Job in Database
    // Prepare data for the createRenderJob function
    const jobCreationData = {
      userId,
      teamId,
      title: title.trim(),
      roomType,
      lighting,
      inputImageUrl: collageImageUrl, // Use the expected parameter name
      // Note: We are not passing roomPhotoUrl to createRenderJob directly
      // It will be passed to the queue worker instead.
      // We might need to add a field like 'renderType' or similar to the DB
      // via createRenderJob if we want to distinguish job types in the DB itself.
    };
    console.log("Calling createRenderJob with data:", jobCreationData);
    // Call the actual function to create the job in the DB
    const newJob = await createRenderJob(jobCreationData); // Pass the correct data structure
    const jobId = newJob.id; // Get the real job ID
    console.log("Render job created with ID:", jobId);


    // 6. Deduct Credits (Mock Implementation)
    console.log(`Deducting ${requiredCredits} credits from team ${teamId} (mock)...`);
    // await deductCredits(teamId, requiredCredits); // Keep commented until implemented


    // 7. Queue the Job for Processing
    // Define job options (similar to the create route)
    const jobOptions: JobsOptions = {
      timeout: 800000, // 800 seconds
      attempts: 2,
      removeOnComplete: true,
      removeOnFail: { count: 100 }
    } as JobsOptions;

    // Data needed by the background worker for this specific job type
    const jobData = {
      jobId: jobId,
      type: 'room-placement', // Add a type to differentiate in the worker
      roomPhotoUrl: roomPhotoUrl,
      collageImageUrl: collageImageUrl,
      // Include other details if needed by worker (e.g., roomType, lighting)
      roomType: roomType,
      lighting: lighting,
    };

    console.log(`Queueing job ${jobId} with data:`, jobData);
    await renderQueue.add(
      'renderJob', // Use a consistent job name or a specific one like 'roomPlacementJob'
      jobData,
      jobOptions
    );
    console.log(`Enqueued job ${jobId} for room placement.`);


    // 8. Return Real Job ID
    return NextResponse.json({ jobId: jobId }); // Return the real job ID

  } catch (error) {
    console.error('[API /place-collage] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Failed to start room placement render: ${errorMessage}` }, { status: 500 });
  }
}
