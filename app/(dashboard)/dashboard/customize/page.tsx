'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input'; // Added Input import
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Sun, Moon, Zap, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// Lighting options
const lightingOptions = [
  { 
    id: 'bright', 
    label: 'Bright', 
    description: 'Well-lit space with natural daylight', 
    icon: Sun 
  },
  { 
    id: 'moody', 
    label: 'Moody', 
    description: 'Dramatic lighting with shadows and contrast', 
    icon: Moon 
  },
  { 
    id: 'warm', 
    label: 'Warm', 
    description: 'Soft, warm lighting with amber tones', 
    icon: Zap 
  },
];

function CustomizeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomType, setRoomType] = useState<string>('');
  const [title, setTitle] = useState<string>(''); // Added title state
  const [lighting, setLighting] = useState<string>('bright');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collageImageUrl, setCollageImageUrl] = useState<string | null>(null);
  const [teamCredits, setTeamCredits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function initialize() {
      console.log("Initializing customize page");
      // Get room type from URL params
      const roomTypeParam = searchParams.get('roomType');
      if (roomTypeParam) {
        console.log("Room type from URL:", roomTypeParam);
        setRoomType(roomTypeParam);
      } else {
        console.warn("No room type parameter found in URL");
      }
      
      // Get collage image URL from session storage
      if (typeof window !== 'undefined') {
        try {
          console.log("Checking session storage for collageImageUrl");
          const storedImageUrl = sessionStorage.getItem('collageImageUrl');
          console.log("Session storage image URL:", storedImageUrl);
          
          if (storedImageUrl) {
            setCollageImageUrl(storedImageUrl);
          } else {
            // Check URL params as a fallback
            const imageUrlParam = searchParams.get('imageUrl');
            if (imageUrlParam) {
              console.log("Using imageUrl from URL params instead:", imageUrlParam);
              setCollageImageUrl(imageUrlParam);
              
              // Try to store in session storage for later
              try {
                sessionStorage.setItem('collageImageUrl', imageUrlParam);
              } catch (e) {
                console.warn("Failed to save imageUrl to session storage:", e);
              }
            } else {
              console.warn("No image URL found in session storage or URL params, redirecting to new-render");
              // If no image URL is found, redirect back to upload page
              router.push('/dashboard/new-render');
              return;
            }
          }
        } catch (error) {
          console.error("Error accessing session storage:", error);
          
          // Check URL params as a fallback
          const imageUrlParam = searchParams.get('imageUrl');
          if (imageUrlParam) {
            console.log("Using imageUrl from URL params as fallback after error:", imageUrlParam);
            setCollageImageUrl(imageUrlParam);
          } else {
            alert("Error accessing session storage. Please try again.");
            router.push('/dashboard/new-render');
            return;
          }
        }
      }
      
      // Fetch team credits
      try {
        console.log("Fetching team credits");
        const response = await fetch('/api/auth/team');
        if (!response.ok) {
          throw new Error('Failed to fetch team info');
        }
        const data = await response.json();
        console.log("Team credits:", data.team?.credits);
        setTeamCredits(data.team?.credits || 0);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching team credits:', error);
        setIsLoading(false);
      }
    }
    
    initialize();
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!collageImageUrl) {
      alert('No image found. Please upload an image first.');
      router.push('/dashboard/new-render');
      alert('Please enter a title for your render.');
      return;
    }

    setIsSubmitting(true);

    // Store the additional configuration in session storage
    console.log("Storing render config:", { title, roomType, lighting, collageImageUrl }); // Log stored data
    sessionStorage.setItem('renderConfig', JSON.stringify({
      title, // Added title
      roomType,
      lighting,
      collageImageUrl
    }));

    // Navigate to rendering progress page
    // No need to pass title in query params, it's in session storage
    router.push(`/dashboard/rendering?roomType=${roomType}&lighting=${lighting}`);
  };

  // Show a warning if team has no credits
  if (teamCredits !== null && teamCredits < 1) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Customize Your Render</h1>
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              No Available Credits
            </CardTitle>
            <CardDescription>
              You need at least 1 credit to create a new render
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <p>Your team currently has 0 credits. Please purchase credits to continue.</p>
            
            <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
              <h3 className="font-medium text-amber-800 mb-2">What are credits?</h3>
              <p className="text-sm text-amber-700">Each render requires 1 credit. Credits are used when your render is complete.</p>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
            <Link href="/pricing">
              <Button>
                Purchase Credits
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Show loading state while checking credits
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-3xl font-bold mb-8">Customize Your Render</h1>
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="mt-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Customize Your Render</h1>
      
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Customization Options</CardTitle>
          <CardDescription>
            Select lighting preferences for your {getRoomTypeLabel(roomType)} visualization
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-8">
            {/* Preview Section */}
            <div className="space-y-2">
              <Label>Your Uploaded Collage</Label>
              <div className="relative w-full h-72 bg-gray-100 rounded-lg overflow-hidden">
                {collageImageUrl ? (
                  <Image
                    src={collageImageUrl}
                    alt="Your uploaded design collage"
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    Loading your image...
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 italic">
                This is your uploaded design collage. The final render will incorporate these design elements.
              </p>
            </div>

            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="renderTitle">Render Title</Label>
              <Input
                id="renderTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Living Room Concept 1"
                required // Make title required
              />
              <p className="text-xs text-gray-500 italic">
                Give your render a descriptive name.
              </p>
            </div>

            {/* Lighting Options */}
            <div className="space-y-4">
              <Label>Lighting Style</Label>
              {/* Removed RadioGroup wrapper */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {lightingOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    // This div now directly handles the click and styling
                    <div
                      key={option.id}
                      role="button" // Add role for accessibility
                      tabIndex={0} // Make it focusable
                      aria-pressed={lighting === option.id} // Indicate selection state
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        lighting === option.id 
                          ? 'border-orange-500 bg-orange-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setLighting(option.id)}
                      onKeyDown={(e) => { // Allow selection with Enter/Space
                        if (e.key === 'Enter' || e.key === ' ') {
                          setLighting(option.id);
                        }
                      }}
                    >
                      {/* Removed RadioGroupItem */}
                      <div className="flex flex-col items-center text-center pointer-events-none"> {/* Prevent inner elements stealing click */}
                        <Icon className={`h-8 w-8 mb-2 ${
                          lighting === option.id ? 'text-orange-500' : 'text-gray-400'
                        }`} />
                        <Label
                          // Removed htmlFor={option.id} as the RadioGroupItem is gone
                          className="font-medium mb-1 cursor-pointer" // Keep cursor pointer for label
                        >
                          {option.label}
                        </Label>
                        <p className="text-xs text-gray-500">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div> {/* This closes the "grid" div */}
            </div>

            {/* Credit Usage Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900">Credit Usage</h3>
              <div className="flex justify-between items-center mt-1">
                <p className="text-sm text-gray-500">
                  This render will use 1 credit from your account.
                </p>
                <p className="text-sm font-medium">
                  Available: {teamCredits} credit{teamCredits !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.back()}
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !collageImageUrl || !title} // Disable if title is empty
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Render...
                </>
              ) : (
                'Generate Render'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

// Helper function to get a readable room type label
function getRoomTypeLabel(roomTypeId: string): string {
  switch (roomTypeId) {
    case 'living_room':
      return 'Living Room';
    case 'bedroom':
      return 'Bedroom';
    case 'kitchen':
      return 'Kitchen';
    case 'bathroom':
      return 'Bathroom';
    case 'office':
      return 'Home Office';
    case 'dining_room':
      return 'Dining Room';
    default:
      return roomTypeId.replace('_', ' ');
  }
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="container mx-auto py-8 text-center">
      <h1 className="text-3xl font-bold mb-8">Preparing Customization</h1>
      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      <p className="mt-4">Loading options...</p>
    </div>
  );
}

export default function CustomizePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CustomizeContent />
    </Suspense>
  );
}
