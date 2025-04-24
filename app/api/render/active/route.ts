import { NextResponse } from 'next/server';
import { getUser, getRecentActiveRenderJobForUser } from '@/lib/db/queries';
import { RenderJob } from '@/lib/db/schema';

export const dynamic = 'force-dynamic'; // Ensure this route is always dynamic

/**
 * GET handler to fetch the most recent active render job for the authenticated user.
 */
export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      console.log('API /api/render/active: User not authenticated');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`API /api/render/active: Fetching active job for user ${user.id}`);
    const activeJob: RenderJob | null = await getRecentActiveRenderJobForUser(user.id);

    if (activeJob) {
      console.log(`API /api/render/active: Found active job ${activeJob.id} for user ${user.id}`);
      return NextResponse.json(activeJob);
    } else {
      console.log(`API /api/render/active: No active job found for user ${user.id}`);
      return NextResponse.json(null); // Return null explicitly if no job found
    }
  } catch (error) {
    console.error('API /api/render/active: Error fetching active render job:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
