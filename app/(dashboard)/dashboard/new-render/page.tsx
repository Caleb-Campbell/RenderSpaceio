'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Added Tabs
import { Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react'; // Adjusted Icons
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
  const [activeTab, setActiveTab] = useState('collage-to-room');

  // --- State for Tab 1: Collage to Room ---
  const [collageImageUrlForCollage, setCollageImageUrlForCollage] = useState<string | null>(null);
  const [title, setTitle] = useState<string>(''); // Shared state for title
  const [roomType, setRoomType] = useState<string>('living_room'); // Shared state
  const [lighting, setLighting] = useState<string>('bright'); // Shared state
  const [isSubmittingCollage, setIsSubmittingCollage] = useState(false);
  const [isUploadingCollage, setIsUploadingCollage] = useState(false);

  // --- State for Tab 2: Room Placement ---
  const [roomPhotoUrl, setRoomPhotoUrl] = useState<string | null>(null);
  const [isUploadingRoomPhoto, setIsUploadingRoomPhoto] = useState(false);
  const [collageImageUrlForPlacement, setCollageImageUrlForPlacement] = useState<string | null>(null);
  const [isUploadingCollageForPlacement, setIsUploadingCollageForPlacement] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [placeCollageError, setPlaceCollageError] = useState<string | null>(null);

  // --- Common State ---
  const [teamCredits, setTeamCredits] = useState<number | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
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
        setIsLoadingCredits(false);
      } catch (error) {
        console.error('Error fetching team credits:', error);
        setIsLoadingCredits(false);
      }
    }
    fetchCredits();
  }, []);

  // --- Upload Handlers ---

  // Handlers for Tab 1 (Collage to Room)
  const handleCollageUploadStarted = () => setIsUploadingCollage(true);
  const handleCollageUploadComplete = (url: string) => {
    console.log("Collage upload completed (Tab 1):", url);
    setCollageImageUrlForCollage(url);
    setIsUploadingCollage(false);
  };
  const handleCollageUploadError = (error: Error) => {
    console.error("Collage upload error (Tab 1):", error);
    setIsUploadingCollage(false);
    alert("Collage upload failed: " + error.message);
  };

  // Handlers for Tab 2 (Room Placement) - Room Photo
  const handleRoomPhotoUploadStarted = () => setIsUploadingRoomPhoto(true);
  const handleRoomPhotoUploadComplete = (url: string) => {
    console.log("Room photo upload completed (Tab 2):", url);
    setRoomPhotoUrl(url);
    setIsUploadingRoomPhoto(false);
  };
  const handleRoomPhotoUploadError = (error: Error) => {
    console.error("Room photo upload error (Tab 2):", error);
    setIsUploadingRoomPhoto(false);
    alert("Room photo upload failed: " + error.message);
  };

  // Handlers for Tab 2 (Room Placement) - Collage
  const handleCollageForPlacementUploadStarted = () => setIsUploadingCollageForPlacement(true);
  const handleCollageForPlacementUploadComplete = (url: string) => {
    console.log("Collage upload completed (Tab 2):", url);
    setCollageImageUrlForPlacement(url);
    setIsUploadingCollageForPlacement(false);
  };
  const handleCollageForPlacementUploadError = (error: Error) => {
    console.error("Collage upload error (Tab 2):", error);
    setIsUploadingCollageForPlacement(false);
    alert("Collage upload failed: " + error.message);
  };


  // --- Submission Handlers ---

  // Handler for Tab 1 (Collage to Room)
  const handleSubmitCollage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collageImageUrlForCollage) {
      alert('Please upload a design collage image first.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a title for your render.');
      return;
    }
    if (teamCredits === null || teamCredits < 1) {
      alert('Insufficient credits.');
      return;
    }
    setIsSubmittingCollage(true);
    try {
      console.log("Submitting collage render request:", { title, roomType, lighting, collageImageUrlForCollage });
      const response = await fetch('/api/render/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          roomType,
          lighting,
          inputImageUrl: collageImageUrlForCollage,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to create render job (HTTP ${response.status})`);
      console.log("Render job created successfully:", result.jobId);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('newRenderSubmitted', 'true');
        sessionStorage.setItem('newlySubmittedJobId', result.jobId);
      }
      router.push('/dashboard/gallery');
    } catch (error) {
      console.error('Error creating render job:', error);
      alert(`Failed to start collage render: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSubmittingCollage(false);
    }
  };

   // Handler for Tab 2 - Submit Room Placement Render
  const handlePlaceCollage = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!roomPhotoUrl) { alert('Please upload a room photo.'); return; }
     if (!collageImageUrlForPlacement) { alert('Please upload a design collage.'); return; }
     if (!title.trim()) { alert('Please enter a title for your render.'); return; }
     if (teamCredits === null || teamCredits < 2) { alert('Insufficient credits (requires 2 credits).'); return; }

     setIsPlacing(true);
     setPlaceCollageError(null);
     try {
       console.log("Submitting room placement request:", { title, roomType, lighting, roomPhotoUrl, collageImageUrlForPlacement });
       // Call the actual API endpoint
       const response = await fetch('/api/render/place-collage', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           title: title.trim(),
           roomType,
           lighting,
           roomPhotoUrl, // Send original room photo
           collageImageUrl: collageImageUrlForPlacement,
         }),
       });

       const result = await response.json();

       if (!response.ok) {
         console.error("API Error Response (place-collage):", result);
         throw new Error(result.error || `Failed to create room placement job (HTTP ${response.status})`);
       }

       console.log("Room placement job created successfully:", result.jobId);

       // Set flag and jobId in session storage before redirecting (same as other flow)
       if (typeof window !== 'undefined') {
         sessionStorage.setItem('newRenderSubmitted', 'true');
         sessionStorage.setItem('newlySubmittedJobId', result.jobId); // Use the REAL jobId from the API response
       }
       router.push('/dashboard/gallery');
     } catch (error) {
       console.error('Error placing collage:', error);
       setPlaceCollageError(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
       setIsPlacing(false);
     }
   };

  // --- Credit Check ---
  const requiredCredits = activeTab === 'room-placement' ? 2 : 1;
  const hasSufficientCredits = teamCredits !== null && teamCredits >= requiredCredits;

  // Show a warning if team has insufficient credits for the selected tab
  if (teamCredits !== null && !hasSufficientCredits) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Create New Render</h1>
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-600"><AlertCircle className="h-5 w-5 mr-2" /> Insufficient Credits</CardTitle>
            <CardDescription>You need at least {requiredCredits} credit{requiredCredits !== 1 ? 's' : ''} for this render type. You have {teamCredits}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Your team currently has {teamCredits} credit{teamCredits !== 1 ? 's' : ''}. Please purchase more credits to continue.</p>
            <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
              <h3 className="font-medium text-amber-800 mb-2">What are credits?</h3>
              <p className="text-sm text-amber-700">
                {activeTab === 'collage-to-room' ? 'This render type requires 1 credit.' : 'This render type requires 2 credits.'} Credits are deducted upon final submission.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
            <Link href="/pricing"><Button>Purchase Credits</Button></Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show loading state while checking credits
  if (isLoadingCredits) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-3xl font-bold mb-8">Create New Render</h1>
        <Loader2 className="h-8 w-8 animate-spin mx-auto" /><p className="mt-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Create New Render</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="collage-to-room">Collage to Room</TabsTrigger>
          <TabsTrigger value="room-placement">Room Placement (Beta)</TabsTrigger>
        </TabsList>

        {/* --- Tab 1: Collage to Room --- */}
        <TabsContent value="collage-to-room">
          <Card>
            <CardHeader>
              <CardTitle>Collage to Room Render</CardTitle>
              <CardDescription>Upload a design collage, choose settings, and generate a room visualization. Cost: 1 Credit.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmitCollage}>
              <CardContent className="space-y-6">
                {/* Credit Info */}
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium mb-1">Available Credits</h3>
                    <p className="text-sm text-gray-600">You have {teamCredits} credit{teamCredits !== 1 ? 's' : ''} available</p>
                  </div>
                  <Link href="/pricing" className="text-sm text-orange-500 hover:text-orange-600">Buy more credits</Link>
                </div>
                {/* Image Upload Area */}
                <div className="space-y-2">
                  <Label htmlFor="collage-tab1">Upload Design Collage</Label>
                  <p className="text-sm text-muted-foreground">We recommend using something like <a href="https://www.shffls.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Shffles</a> to create your collage.</p>
                  <UploadDropzone onUploadStart={handleCollageUploadStarted} onUploadComplete={handleCollageUploadComplete} onUploadError={handleCollageUploadError} />
                  {isUploadingCollage && <div className="flex items-center text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</div>}
                  {collageImageUrlForCollage && !isUploadingCollage && <p className="text-sm text-green-600">Upload complete!</p>}
                </div>
                {/* Title Input */}
                <div className="space-y-2">
                  <Label htmlFor="title-tab1">Render Title</Label>
                  <Input id="title-tab1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Cozy Living Room Concept" required />
                </div>
                {/* Room Type Selection */}
                <div className="space-y-2">
                  <Label>Room Type</Label>
                  <RadioGroup value={roomType} onValueChange={setRoomType} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {roomTypes.map((room) => (<div key={room.id} className="flex items-center space-x-2"><RadioGroupItem value={room.id} id={`room-tab1-${room.id}`} /><Label htmlFor={`room-tab1-${room.id}`}>{room.label}</Label></div>))}
                  </RadioGroup>
                </div>
                {/* Lighting Selection */}
                <div className="space-y-2">
                  <Label>Lighting Style</Label>
                  <RadioGroup value={lighting} onValueChange={setLighting} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {lightingOptions.map((light) => (<div key={light.id} className="flex items-center space-x-2"><RadioGroupItem value={light.id} id={`light-tab1-${light.id}`} /><Label htmlFor={`light-tab1-${light.id}`}>{light.label}</Label></div>))}
                  </RadioGroup>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>Cancel</Button>
                <Button type="submit" disabled={!collageImageUrlForCollage || isSubmittingCollage || isUploadingCollage || !hasSufficientCredits}>
                  {isSubmittingCollage ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>) : ('Start Render (1 Credit)')}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* --- Tab 2: Room Placement (Beta) --- */}
        <TabsContent value="room-placement">
          <Card>
            <CardHeader>
              <CardTitle>Room Placement Render (Beta)</CardTitle>
              <CardDescription>Upload a photo of a real room and a design collage to place elements within the room. Total Cost: 2 Credits.</CardDescription>
            </CardHeader>
             <form onSubmit={handlePlaceCollage}>
               <CardContent className="space-y-6">
                 {/* Credit Info */}
                 <div className="bg-blue-50 p-4 rounded-md border border-blue-200 flex items-center justify-between mb-6">
                   <div>
                     <h3 className="font-medium mb-1 text-blue-800">Available Credits</h3>
                     <p className="text-sm text-blue-700">You have {teamCredits} credit{teamCredits !== 1 ? 's' : ''} available. This render costs 2 credits.</p>
                   </div>
                   <Link href="/pricing" className="text-sm text-orange-500 hover:text-orange-600">Buy more credits</Link>
                 </div>

                 {/* Combined Inputs for Room Placement */}
                 <div className="space-y-6">
                     {/* Upload Room Photo */}
                     <div className="space-y-2 p-4 border rounded-md">
                       <Label htmlFor="room-photo-upload" className="text-lg font-semibold flex items-center"><ImageIcon className="mr-2 h-5 w-5"/> 1. Upload Room Photo</Label>
                       <p className="text-sm text-muted-foreground">Upload a clear photo of the room you want to place the design into.</p>
                       <UploadDropzone onUploadStart={handleRoomPhotoUploadStarted} onUploadComplete={handleRoomPhotoUploadComplete} onUploadError={handleRoomPhotoUploadError} />
                       {isUploadingRoomPhoto && <div className="flex items-center text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading room photo...</div>}
                       {roomPhotoUrl && !isUploadingRoomPhoto && <p className="text-sm text-green-600">Room photo upload complete!</p>}
                     </div>

                    {/* Upload Design Collage */}
                    <div className="space-y-2 p-4 border rounded-md">
                      <Label htmlFor="collage-tab2" className="text-lg font-semibold flex items-center"><ImageIcon className="mr-2 h-5 w-5"/> 2. Upload Design Collage</Label>
                      <p className="text-sm text-muted-foreground">Upload the design collage you want to place in the room.</p>
                      <UploadDropzone onUploadStart={handleCollageForPlacementUploadStarted} onUploadComplete={handleCollageForPlacementUploadComplete} onUploadError={handleCollageForPlacementUploadError} />
                      {isUploadingCollageForPlacement && <div className="flex items-center text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading collage...</div>}
                      {collageImageUrlForPlacement && !isUploadingCollageForPlacement && <p className="text-sm text-green-600">Collage upload complete!</p>}
                    </div>

                    {/* Final Details */}
                    <div className="space-y-6 p-4 border rounded-md">
                       <h3 className="text-lg font-semibold">3. Final Details</h3>
                       {/* Title Input */}
                       <div className="space-y-2">
                         <Label htmlFor="title-tab2">Render Title</Label>
                         <Input id="title-tab2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Modern Design in Client's Living Room" required />
                       </div>
                       {/* Room Type Selection */}
                       <div className="space-y-2">
                         <Label>Room Type (For AI context)</Label>
                         <RadioGroup value={roomType} onValueChange={setRoomType} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                           {roomTypes.map((room) => (<div key={room.id} className="flex items-center space-x-2"><RadioGroupItem value={room.id} id={`room-tab2-${room.id}`} /><Label htmlFor={`room-tab2-${room.id}`}>{room.label}</Label></div>))}
                         </RadioGroup>
                       </div>
                       {/* Lighting Selection */}
                       <div className="space-y-2">
                         <Label>Lighting Style (For AI context)</Label>
                         <RadioGroup value={lighting} onValueChange={setLighting} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                           {lightingOptions.map((light) => (<div key={light.id} className="flex items-center space-x-2"><RadioGroupItem value={light.id} id={`light-tab2-${light.id}`} /><Label htmlFor={`light-tab2-${light.id}`}>{light.label}</Label></div>))}
                         </RadioGroup>
                       </div>
                    </div>
                 </div>

                  {placeCollageError && <p className="text-sm text-red-600 mt-2">{placeCollageError}</p>}

               </CardContent>
               <CardFooter className="flex justify-between">
                 <Button variant="outline" onClick={() => router.push('/dashboard')}>Cancel</Button>
                 <Button type="submit" disabled={!roomPhotoUrl || !collageImageUrlForPlacement || !title.trim() || isPlacing || isUploadingRoomPhoto || isUploadingCollageForPlacement || !hasSufficientCredits}>
                   {isPlacing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Final Render...</>) : ('Start Final Render (2 Credits)')}
                 </Button>
               </CardFooter>
             </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
