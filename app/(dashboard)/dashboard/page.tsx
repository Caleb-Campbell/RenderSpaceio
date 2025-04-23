import { redirect } from 'next/navigation';
import { 
  getTeamForUser, 
  getUser, 
  getTotalRendersForTeam, 
  getRecentRendersCountForTeam, 
  getRecentRendersForTeam 
} from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Image as ImageIcon, History, CreditCard } from 'lucide-react'; // Renamed Image to avoid conflict
import Link from 'next/link';
import Image from 'next/image'; // Import Next.js Image component
import { formatDistanceToNow } from 'date-fns'; // Import date-fns for relative time

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const teamData = await getTeamForUser(user.id);

  if (!teamData) {
    throw new Error('Team not found');
  }

  // Fetch render stats and recent renders
  const [totalRenders, recentRendersCount, recentRendersData] = await Promise.all([
    getTotalRendersForTeam(teamData.id),
    getRecentRendersCountForTeam(teamData.id, 7), // Count for the last 7 days
    getRecentRendersForTeam(teamData.id, 3) // Get the latest 3 renders
  ]);
  
  const stats = {
    credits: teamData.credits,
    totalRenders,
    recentRenders: recentRendersCount
  };

  // Helper function for relative time
  const formatRelativeTime = (date: Date | null | undefined) => {
    if (!date) return 'Unknown date';
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        
        <Link href="/dashboard/new-render">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Render
          </Button>
        </Link>
      </div>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available Credits</CardTitle>
            <CreditCard className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.credits}</div>
            <p className="text-xs text-gray-500 mt-1">
              1 credit = 1 render
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Renders</CardTitle>
            <ImageIcon className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRenders}</div>
            <p className="text-xs text-gray-500 mt-1">
              Across all projects
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <History className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentRenders}</div>
            <p className="text-xs text-gray-500 mt-1">
              Renders in the past 7 days
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Actions */}
      <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="hover:border-orange-500 transition-colors cursor-pointer">
          <Link href="/dashboard/new-render" className="block p-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="font-medium">New Render</h3>
              <p className="text-sm text-gray-500 mt-1">Create a visualization</p>
            </div>
          </Link>
        </Card>
        
        <Card className="hover:border-orange-500 transition-colors cursor-pointer">
          <Link href="/dashboard/gallery" className="block p-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <ImageIcon className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="font-medium">View Gallery</h3>
              <p className="text-sm text-gray-500 mt-1">Browse all renders</p>
            </div>
          </Link>
        </Card>
        
        <Card className="hover:border-orange-500 transition-colors cursor-pointer">
          <Link href="/pricing" className="block p-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="font-medium">Buy Credits</h3>
              <p className="text-sm text-gray-500 mt-1">Purchase render credits</p>
            </div>
          </Link>
        </Card>
        
        <Card className="hover:border-orange-500 transition-colors cursor-pointer">
          <Link href="/dashboard/general" className="block p-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-medium">Settings</h3>
              <p className="text-sm text-gray-500 mt-1">Manage your account</p>
            </div>
          </Link>
        </Card>
      </div>
      
      {/* Recent Renders */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Renders</h2>
          <Link href="/dashboard/gallery" className="text-sm text-orange-500 hover:text-orange-600">
            View all
          </Link>
        </div>
        
        {recentRendersData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentRendersData.map((render) => (
              <Link key={render.id} href={`/dashboard/result/${render.id}`} passHref>
                <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col">
                  <div className="relative aspect-video bg-gray-100">
                    {render.resultImagePath ? (
                      <Image
                        src={render.resultImagePath}
                        alt={render.title || 'Render preview'}
                        layout="fill"
                        objectFit="cover"
                        className="transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        Processing...
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 flex-grow">
                    <h3 className="font-medium text-gray-900 truncate" title={render.title || 'Untitled Render'}>
                      {render.title || 'Untitled Render'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Created {formatRelativeTime(render.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900">No renders yet</h3>
            <p className="mt-2 text-gray-500">
              Create your first visualization to get started.
            </p>
            <Link href="/dashboard/new-render">
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create First Render
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
