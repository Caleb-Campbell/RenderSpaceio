 'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input'; // Added Input
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

// Lighting options (can be expanded)
const lightingOptions = [
  { id: 'bright', label: 'Bright' },
  { id: 'moody', label: 'Moody' },
  { id: 'warm', label: 'Warm' },
  // Add more if needed
];

export default function NewRenderPage() {
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>(''); // Added title state
  const [roomType, setRoomType] = useState<string>('living_room');
  const [lighting, setLighting] = useState<string>('bright'); // Added lighting state
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
      alert('Please upload a design collage image first.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a title for your render.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log("Submitting render request:", { title, roomType, lighting, uploadedImageUrl });
      
      const response = await fetch('/api/render/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          roomType,
          lighting,
          inputImageUrl: uploadedImageUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("API Error Response:", result);
        throw new Error(result.error || `Failed to create render job (HTTP ${response.status})`);
      }

      console.log("Render job created successfully:", result.jobId);
      
      // Set flag and jobId in session storage before redirecting
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('newRenderSubmitted', 'true');
        sessionStorage.setItem('newlySubmittedJobId', result.jobId); // Store the jobId
      }
      
      // Redirect to gallery immediately after successful submission
      router.push('/dashboard/gallery');
      
      // No need to setIsSubmitting(false) as we are navigating away

    } catch (error) {
      console.error('Error creating render job:', error);
      alert(`Failed to start render: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSubmitting(false); // Only set back to false on error
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
              <p className="text-sm text-muted-foreground">
                We recommend using something like <a href="https://www.shffls.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Shffles</a> to create your collage.
              </p>
              <UploadDropzone 
                onUploadStart={handleUploadStarted}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
              {isUploading && (
                <div className="flex items-center text-sm text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </div>
              )}
              {uploadedImageUrl && !isUploading && (
                 <p className="text-sm text-green-600">Upload complete!</p>
              )}
            </div>

            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="title">Render Title</Label>
              <Input 
                id="title" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="e.g., Cozy Living Room Concept"
                required 
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
                    <RadioGroupItem value={room.id} id={`room-${room.id}`} />
                    <Label htmlFor={`room-${room.id}`}>{room.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Lighting Selection */}
            <div className="space-y-2">
              <Label>Lighting Style</Label>
              <RadioGroup 
                value={lighting} 
                onValueChange={setLighting}
                className="grid grid-cols-2 gap-4 sm:grid-cols-3"
              >
                {lightingOptions.map((light) => (
                  <div key={light.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={light.id} id={`light-${light.id}`} />
                    <Label htmlFor={`light-${light.id}`}>{light.label}</Label>
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
                  Submitting...
                </>
              ) : (
                'Start Render' // Changed button text
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
