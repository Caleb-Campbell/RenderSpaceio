'use client';

import { useState, useEffect, Suspense, use } from 'react'; // Added 'use'
import { useRouter } from 'next/navigation'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label'; // Added
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'; // Added
import { Download, Share2, Redo, Plus, Loader2, Sun, Moon, Zap } from 'lucide-react'; // Added icons
import Image from 'next/image';
import Link from 'next/link'; // Added

// Define lighting options (copied from customize page)
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

// Define the type for a lighting option
type LightingOption = typeof lightingOptions[number];

// Define the expected shape of the resolved params
interface ResolvedParams {
  id: string;
}

// Accept the params Promise as a prop
function ResultContent({ paramsPromise }: { paramsPromise: Promise<ResolvedParams> }) {
  // Unwrap the params Promise using React.use()
  const params = use(paramsPromise);
  const jobId = params?.id || null; // Extract jobId after resolving

  const router = useRouter();
  // Removed searchParams usage
  const [roomType, setRoomType] = useState('');
  const [lighting, setLighting] = useState(''); // Original lighting
  const [selectedLighting, setSelectedLighting] = useState(''); // User-selected lighting for re-render
  const [inputImage, setInputImage] = useState<string | null>(null); // State for input image, initialize as null
  const [renderImage, setRenderImage] = useState<string | null>(null); // State for result image, initialize as null
  const [renderJob, setRenderJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRerendering, setIsRerendering] = useState(false); // Added state for re-render button
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Use jobId from props
    if (!jobId) {
      setError('No render job ID provided in URL');
      setIsLoading(false);
      return;
    }
    
    // Fetch the render job result
    const fetchRenderJob = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/render/status?id=${jobId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch render result');
        }
        
        const job = await response.json();
        console.log("Render Result Returned (Client-side):", job); // Log the returned job data
        
        // Set the job data
        setRenderJob(job);
        setRoomType(job.roomType || '');
        const originalLighting = job.lighting || 'bright'; // Default if missing
        setLighting(originalLighting);
        setSelectedLighting(originalLighting); // Initialize selected lighting

        // Set the image URLs only if they exist, otherwise they remain null
        setInputImage(job.inputImagePath || null);
        setRenderImage(job.resultImagePath || null);


        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching render job:', err);
        setError('Failed to load render result. Please try again.');
        setIsLoading(false);
      }
    };
    
    fetchRenderJob();
  }, [jobId]); // Update dependency array
  
  // Updated handleDownload function to fetch blob and force download
  const handleDownload = async () => {
    if (!renderImage) { // Check if renderImage is null
      alert('No render image available to download');
      return;
    }

    try {
      // Fetch the image data
      const response = await fetch(renderImage);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();

      // Create an object URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = `RenderSpace_${getRoomTypeLabel(roomType)}_${getLightingLabel(lighting)}.png`; // Suggest a filename
      document.body.appendChild(a); // Append to body to ensure click works

      // Trigger the download
      a.click();

      // Clean up: remove the anchor and revoke the object URL
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download the image. Please try again or right-click the image to save.');
    }
  };

  const handleShare = () => {
    if (!renderImage) { // Check if renderImage is null
      alert('No render image available to share');
      return;
    }

    // Check if Web Share API is available
    if (navigator.share) {
      navigator.share({
        title: `My ${getRoomTypeLabel(roomType)} Render`,
        text: `Check out my ${getRoomTypeLabel(roomType)} with ${getLightingLabel(lighting)} lighting, generated with RenderSpace!`,
        url: window.location.href,
      })
      .catch(error => {
        console.error('Error sharing:', error);
      });
    } else {
      // Fallback to copying the URL to clipboard
      navigator.clipboard.writeText(window.location.href)
        .then(() => {
          alert('Link copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy link:', err);
          alert('Failed to copy link. Please copy the URL manually.');
        });
    }
  };

  const handleRerender = () => {
    // Use inputImagePath now
    if (!renderJob || !renderJob.inputImagePath) { 
      alert('Cannot re-render: Input image URL not found.');
      return;
    }
    if (selectedLighting === lighting) {
      alert('Please select a different lighting style to re-render.');
      return;
    }

    setIsRerendering(true);

    // Prepare the new config
    const newRenderConfig = {
      roomType: renderJob.roomType,
      lighting: selectedLighting, // Use the newly selected lighting
      inputImageUrl: renderJob.inputImagePath, // Use inputImagePath
      title: `${getRoomTypeLabel(renderJob.roomType)} with ${getLightingLabel(selectedLighting)} lighting (Re-render)`
    };

    // Store the updated configuration in session storage
    sessionStorage.setItem('renderConfig', JSON.stringify(newRenderConfig));

    // Navigate to rendering progress page with rerender flag
    router.push(`/dashboard/rendering?rerender=true&fromJobId=${renderJob.id}`);
  };

  const handleCreateSimilar = () => {
    // Use inputImagePath now
    if (!renderJob || !renderJob.inputImagePath) { 
      alert('Cannot create similar: Input image URL not found.');
      return;
    }
    // Store the input image URL in session storage before navigating
    sessionStorage.setItem('collageImageUrl', renderJob.inputImagePath); // Keep session key for now if customize page expects it
    // Navigate back to the customization page with the same room type
    router.push(`/dashboard/customize?roomType=${roomType}&imageUrl=${encodeURIComponent(renderJob.inputImagePath)}`);
  };

  const handleNewRender = () => {
    // Navigate to the new render page
    router.push('/dashboard/new-render');
  };
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Your Render Result</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Final Visualization</CardTitle>
              <CardDescription>
                {getRoomTypeLabel(roomType)} with {getLightingLabel(lighting)} lighting
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6"> {/* Added space-y */}
              {/* Result Image */}
              <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
                  </div>
                ) : error ? (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <p className="text-red-500">{error}</p>
                  </div>
                ) : renderImage ? ( // Only render Image if renderImage is not null
                  <Image 
                    src={renderImage} 
                    alt={`${getRoomTypeLabel(roomType)} with ${getLightingLabel(lighting)} lighting`}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : ( // Display message if loading is done but renderImage is still null
                   <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <p>Render image not available.</p> 
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                  {getRoomTypeLabel(roomType)}
                </span>
                <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                  {getLightingLabel(lighting)}
                </span>
              </div>

              {/* Input Image Preview */}
              {/* Input Image Preview - Only show if inputImage is not null */}
              {!isLoading && !error && inputImage && ( 
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Input Image</h3>
                  <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                    <Image 
                      src={inputImage} // inputImage is already checked for null above
                      alt="Input image used for the render"
                      fill
                      className="object-contain" // Use contain to show the whole image
                    />
                  </div>
                </div>
              )}
            </CardContent>
            
            <CardFooter className="flex flex-wrap gap-3">
              <Button onClick={handleDownload} className="flex-1 sm:flex-none">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={handleShare} className="flex-1 sm:flex-none">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" onClick={handleCreateSimilar} className="flex-1 sm:flex-none">
                <Redo className="h-4 w-4 mr-2" />
                Similar
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          {/* Render Details Card */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Render Details</CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Room Type</h3>
                    <p className="text-gray-900">{getRoomTypeLabel(roomType)}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Lighting</h3>
                    <p className="text-gray-900">{getLightingLabel(lighting)}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Resolution</h3>
                    <p className="text-gray-900">1024 x 1024 px</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Created</h3>
                    <p className="text-gray-900">
                      {renderJob?.createdAt 
                        ? new Date(renderJob.createdAt).toLocaleString() 
                        : 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Completed</h3>
                    <p className="text-gray-900">
                      {renderJob?.completedAt 
                        ? new Date(renderJob.completedAt).toLocaleString() 
                        : 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Credit Usage</h3>
                    <p className="text-gray-900">1 credit</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Re-render Options Card */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Change Lighting & Re-render</CardTitle>
              <CardDescription>Select a new lighting style and generate again. This will use 1 credit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={selectedLighting}
                onValueChange={setSelectedLighting}
                className="grid grid-cols-3 gap-2" // Adjusted grid for smaller space
                disabled={isLoading || isRerendering}
              >
                {lightingOptions.map((option: LightingOption) => { // Added type annotation
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-all text-center ${
                        selectedLighting === option.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${isLoading || isRerendering ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => !isLoading && !isRerendering && setSelectedLighting(option.id)}
                    >
                      <RadioGroupItem
                        value={option.id}
                        id={`rerender-${option.id}`}
                        className="sr-only"
                        disabled={isLoading || isRerendering}
                      />
                      <Icon className={`h-6 w-6 mb-1 mx-auto ${
                        selectedLighting === option.id ? 'text-orange-500' : 'text-gray-400'
                      }`} />
                      <Label
                        htmlFor={`rerender-${option.id}`}
                        className="text-xs font-medium"
                      >
                        {option.label}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
              <Button
                onClick={handleRerender}
                disabled={isLoading || isRerendering || selectedLighting === lighting}
                className="w-full"
              >
                {isRerendering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Re-render...
                  </>
                ) : (
                  'Re-render with New Lighting (1 Credit)'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* What's Next Card */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Other Actions</CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Create another visualization or explore your previous renders.
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                <Button onClick={handleNewRender} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  New Render
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/dashboard/gallery')}
                  className="w-full"
                >
                  View All Renders
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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

// Helper function to get a readable lighting label
function getLightingLabel(lightingId: string): string {
  switch (lightingId) {
    case 'bright':
      return 'Bright';
    case 'moody':
      return 'Moody';
    case 'warm':
      return 'Warm';
    default:
      return lightingId.charAt(0).toUpperCase() + lightingId.slice(1);
  }
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="container mx-auto py-8 text-center">
      <h1 className="text-3xl font-bold mb-8">Loading Render Result</h1>
      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      <p className="mt-4">Loading your visualization...</p>
    </div>
  );
}

// Accept params from Next.js dynamic route
export default function ResultPage({ params }: { params: Promise<ResolvedParams> }) { // params is a Promise here
  // Pass the params Promise directly to the client component
  return (
    <Suspense fallback={<LoadingFallback />}>
      {/* Pass the params Promise to the content component */}
      <ResultContent paramsPromise={params} /> 
    </Suspense>
  );
}
