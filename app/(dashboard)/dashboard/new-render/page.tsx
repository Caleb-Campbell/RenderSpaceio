'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UploadDropzone } from '@/components/ui/upload-dropzone';
import { useUploadThing, UploadFileResponse } from '@/lib/uploadthing/hooks';
import Link from 'next/link';

// Room type options
const roomTypes = [
  { id: 'living_room', label: 'Living Room' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'office', label: 'Home Office' },
  { id: 'dining_room', label: 'Dining Room' },
];

export default function NewRenderPage() {
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [roomType, setRoomType] = useState<string>('living_room');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [teamCredits, setTeamCredits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  // Fetch team credits
  useEffect(() => {
    async function fetchCredits() {
      try {
        const response = await fetch('/api/auth/team');
        if (!response.ok) {
          throw new Error('Failed to fetch team info');
        }
        const data = await response.json();
        setTeamCredits(data.team?.credits || 0);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching team credits:', error);
        setIsLoading(false);
      }
    }
    
    fetchCredits();
  }, []);
  
  // Track upload status and handle completed uploads
  
  const handleUploadStarted = () => {
    setIsUploading(true);
  };
  
  const handleUploadComplete = (url: string) => {
    console.log("Upload completed with URL:", url);
    setUploadedImageUrl(url);
    setIsUploading(false);
    
    // Also save to session storage immediately in case the form is submitted quickly
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('collageImageUrl', url);
    }
  };
  
  const handleUploadError = (error: Error) => {
    console.error("Upload error:", error);
    setIsUploading(false);
    alert("Upload failed: " + error.message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!uploadedImageUrl) {
      alert('Please upload a collage image');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Store the image URL in session storage to pass to the next page
      console.log("Storing image URL in session storage:", uploadedImageUrl);
      
      if (typeof window !== 'undefined') {
        // First clear any existing value to ensure we're not using stale data
        sessionStorage.removeItem('collageImageUrl');
        
        // Then set the new value
        sessionStorage.setItem('collageImageUrl', uploadedImageUrl);
        
        // Verify it was set correctly
        const storedUrl = sessionStorage.getItem('collageImageUrl');
        console.log("Verified stored URL:", storedUrl);
        
        if (!storedUrl) {
          throw new Error("Failed to store image URL in session storage");
        }
      }
      
      // Use a timeout to ensure session storage has time to update
      setTimeout(() => {
        // Navigate to customization page with both roomType and imageUrl (as fallback)
        router.push(`/dashboard/customize?roomType=${roomType}&imageUrl=${encodeURIComponent(uploadedImageUrl)}`);
      }, 100);
    } catch (error) {
      console.error('Error saving image data:', error);
      alert('There was a problem saving your upload data. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Show a warning if team has no credits
  if (teamCredits !== null && teamCredits < 1) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Create New Render</h1>
        
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
        <h1 className="text-3xl font-bold mb-8">Create New Render</h1>
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="mt-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Create New Render</h1>
      
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Image Upload</CardTitle>
          <CardDescription>
            Upload a collage of interior design elements and select the room type for your visualization
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Credit Info */}
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-medium mb-1">Available Credits</h3>
                <p className="text-sm text-gray-600">You have {teamCredits} credit{teamCredits !== 1 ? 's' : ''} available</p>
              </div>
              <Link href="/pricing" className="text-sm text-orange-500 hover:text-orange-600">
                Buy more credits
              </Link>
            </div>
            
            {/* Image Upload Area */}
            <div className="space-y-2">
              <Label htmlFor="collage">Upload Design Collage</Label>
              <UploadDropzone 
                onUploadStart={handleUploadStarted}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </div>
            
            {/* Room Type Selection */}
            <div className="space-y-2">
              <Label>Room Type</Label>
              <RadioGroup 
                value={roomType} 
                onValueChange={setRoomType}
                className="grid grid-cols-2 gap-4 sm:grid-cols-3"
              >
                {roomTypes.map((room) => (
                  <div key={room.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={room.id} id={room.id} />
                    <Label htmlFor={room.id}>{room.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!uploadedImageUrl || isSubmitting || isUploading}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Continue to Customization'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}