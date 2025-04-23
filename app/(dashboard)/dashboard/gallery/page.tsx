import { Suspense } from 'react';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getRenderJobs } from '@/lib/render';
import { RenderStatus } from '@/lib/db/schema';
import { Loader2 } from 'lucide-react';
import GalleryClientComponent from './GalleryClientComponent'; // Import the new client component

// Filter options (can remain here or be moved to client component if needed)
const filterOptions = {
  roomTypes: [
    { value: 'all', label: 'All Rooms' },
    { value: 'living_room', label: 'Living Room' },
    { value: 'bedroom', label: 'Bedroom' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'office', label: 'Home Office' },
  ],
  sortBy: [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
  ]
};

// Loading fallback (Server Component)
function LoadingFallback() {
  return (
    <div className="container mx-auto py-8 text-center">
      <h1 className="text-3xl font-bold mb-8">Loading Gallery</h1>
      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      <p className="mt-4">Loading your renders...</p>
    </div>
  );
}

// Main Page Component (Server Component)
export default async function GalleryPage() {
  // Fetch user and team data on the server
  const user = await getUser();
  if (!user) {
    // Handle case where user is not authenticated
    // Maybe redirect to login or show an error message - handled client-side for now
    // Or render a specific message here
    return <div className="container mx-auto py-8 text-center text-red-500">Error: User not authenticated. Please log in.</div>;
  }

  const userData = await getUserWithTeam(user.id);
  if (!userData || !userData.teamId) {
    // Handle case where user or team is not found
    return <div className="container mx-auto py-8 text-center text-red-500">Error: Could not load user data.</div>;
  }
  const teamId = userData.teamId;

  // Fetch actual render jobs on the server
  const initialRenderJobs = await getRenderJobs(teamId);

  // Filter for completed jobs initially (can also be done client-side if preferred)
  const completedRenderJobs = initialRenderJobs.filter(
    render => render.status === RenderStatus.COMPLETED
  );

  return (
    <Suspense fallback={<LoadingFallback />}>
      <GalleryClientComponent
        initialRenders={completedRenderJobs}
        filterOptions={filterOptions}
      />
    </Suspense>
  );
}
