'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react'; // Import useRef and useCallback
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';

type RenderConfig = {
  roomType: string;
  lighting: string;
  collageImageUrl: string;
  title?: string;
};

function RenderingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Removed progress and estimatedTime state
  const [renderJobId, setRenderJobId] = useState<string | null>(null); // Changed type to string | null
  const [error, setError] = useState<string | null>(null);
  const [renderConfig, setRenderConfig] = useState<RenderConfig | null>(null);
  // Removed teamCredits state, check happens within createJob
  const jobCreatedRef = useRef(false); // Ref to track job creation initiation
  const jobCreationAttemptedRef = useRef(false); // Ref to prevent multiple creation attempts

  // Effect 1: Load config from sessionStorage and handle re-render logic
  useEffect(() => {
    const isRerender = searchParams.get('rerender') === 'true';
    console.log("Checking config, isRerender:", isRerender);

    // Reset job creation refs if it's a re-render request
    if (isRerender) {
      console.log("Re-render requested, resetting job creation locks.");
      jobCreatedRef.current = false;
      jobCreationAttemptedRef.current = false;
      setRenderJobId(null); // Reset job ID for re-render
      setError(null); // Clear previous errors
    }

    // Only load config if it's not already loaded or if it's a re-render
    if (!renderConfig || isRerender) {
        const storedConfig = typeof window !== 'undefined' ? sessionStorage.getItem('renderConfig') : null;
        if (!storedConfig) {
            console.error('No render configuration found in sessionStorage.');
            setError('No render configuration found. Please start a new render.');
            // Optionally redirect: router.push('/dashboard/new-render');
            return;
        }
        try {
            const config = JSON.parse(storedConfig) as RenderConfig;
            console.log("Loaded config from storage:", config);
            setRenderConfig(config);
        } catch (e) {
            console.error("Failed to parse render config:", e);
            setError("Invalid render configuration found.");
        }
    }
  // Depend only on searchParams to detect re-renders. renderConfig is set inside, avoid dependency loop.
  }, [searchParams, router]); // Added router for potential redirect

  // Effect 2: Check credits and create the job once config is ready
  const createJob = useCallback(async (config: RenderConfig) => {
    if (!config) {
        console.log("createJob called without config, skipping.");
        return;
    }
    // Prevent multiple attempts triggered by rapid state changes
    if (jobCreationAttemptedRef.current) {
        console.log("Job creation already attempted, skipping.");
        return;
    }
    jobCreationAttemptedRef.current = true; // Mark attempt

    console.log("Attempting to create job...");
    setError(null); // Clear previous errors before attempting

    // 1. Check Credits
    try {
      const creditsResponse = await fetch('/api/auth/team');
      if (!creditsResponse.ok) {
        throw new Error('Failed to fetch team info for credit check');
      }
      const teamData = await creditsResponse.json();
      const credits = teamData.team?.credits || 0;
      console.log("Credits check:", credits);

      if (credits < 1) {
        setError('Not enough credits to create a render. Please purchase credits first.');
        jobCreationAttemptedRef.current = false; // Allow retry if user gets credits
        return; // Stop job creation
      }
    } catch (error) {
      console.error('Error checking credits:', error);
      setError('Failed to check credits. Please try again.');
      jobCreationAttemptedRef.current = false; // Allow retry
      return; // Stop job creation
    }

    // 2. Create Job if credits are sufficient
    try {
      console.log("Credits sufficient, proceeding to create render job with config:", config);
      // Use the title from the config object directly
      if (!config.title) {
        // Add a fallback or error handling in case title is missing, though it shouldn't be
        console.error("Title is missing from render config!");
        setError("Render title is missing. Please start over.");
        jobCreationAttemptedRef.current = false; // Allow retry
        return;
      }
      const createResponse = await fetch('/api/render/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: config.title, // Use the title from the config
          roomType: config.roomType,
          lighting: config.lighting,
          inputImageUrl: config.collageImageUrl, // Ensure key matches API expectation ('inputImageUrl')
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.message || 'Failed to create render job');
      }

      const data = await createResponse.json();
      console.log("Job created successfully, Job ID:", data.jobId);
      jobCreatedRef.current = true; // Mark as successfully initiated
      setRenderJobId(data.jobId); // Trigger polling

    } catch (err) {
      console.error('Error creating render job:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while creating the render job');
      jobCreatedRef.current = false; // Reset flags if creation failed
      jobCreationAttemptedRef.current = false;
    }
  }, [router]); // Include router if needed for redirects inside createJob

  // Effect 2 (cont.): Trigger createJob when conditions are met
  useEffect(() => {
    // Only attempt job creation if:
    // 1. Config is loaded (`renderConfig` is not null)
    // 2. Job ID is not already set (`renderJobId` is null)
    // 3. Job creation hasn't been successfully initiated (`jobCreatedRef.current` is false)
    // 4. Job creation hasn't been attempted yet in this cycle (`jobCreationAttemptedRef.current` is false)
    if (renderConfig && !renderJobId && !jobCreatedRef.current && !jobCreationAttemptedRef.current) {
      console.log("Conditions met, calling createJob.");
      createJob(renderConfig);
    } else {
      console.log("Skipping job creation call:", {
          hasConfig: !!renderConfig,
          hasJobId: !!renderJobId,
          jobCreated: jobCreatedRef.current,
          jobAttempted: jobCreationAttemptedRef.current
      });
    }
    // This effect depends on renderConfig being loaded and the createJob function reference
  }, [renderConfig, renderJobId, createJob]);


  // Effect 3: Poll for job status (depends only on renderJobId)
  useEffect(() => {
    if (!renderJobId) return;
    
    const checkJobStatus = async () => {
      console.log(`Polling status for job ID: ${renderJobId}...`); // Log before fetch
      try {
        const response = await fetch(`/api/render/status?id=${renderJobId}`);
        console.log(`Polling response status: ${response.status}`); // Log response status
        if (!response.ok) {
          const errorText = await response.text(); // Try to get error text
          console.error(`Polling failed with status ${response.status}: ${errorText}`);
          throw new Error(`Failed to check job status (${response.status})`);
        }
        console.log("Polling response received successfully."); // Log successful fetch
        
        const job = await response.json();
        console.log(`Job status: ${job.status}, error: ${job.errorMessage || 'none'}`);
        
        // Handle job status without updating progress state
        if (job.status === 'processing') {
          // Still processing, do nothing here, just wait for next poll
        } else if (job.status === 'completed') {
          // Navigate to results page using dynamic route segment
          console.log(`Job completed, redirecting to /dashboard/result/${renderJobId}`);
          setTimeout(() => {
            router.push(`/dashboard/result/${renderJobId}`); // Corrected URL format
          }, 1000); // Keep a small delay for UI transition
        } else if (job.status === 'failed') {
          const errorMsg = job.errorMessage || 'Render failed';
          console.error('Render job failed:', errorMsg);
          
          // If it's an UploadThing error but we have a result image, 
          // we can still redirect to results page (even on failure if image exists)
          if (errorMsg.includes('UploadThing') && job.resultImagePath) {
            console.log('UploadThing error but image exists, proceeding to results page');
            setTimeout(() => {
              router.push(`/dashboard/result/${renderJobId}`); // Corrected URL format here too
            }, 1000);
          } else {
            setError(errorMsg);
            // No progress state to reset
          }
         }
       } catch (err) {
         console.error('Polling Error Caught:', err); // Log the caught error
         // Set error state to break the loop and inform the user
         setError(err instanceof Error ? `Polling failed: ${err.message}` : 'An unknown error occurred while checking render status.');
       }
     };
    
    // Check status immediately
    checkJobStatus();
    
    // Then set up polling interval
    const statusInterval = setInterval(checkJobStatus, 3000);
    return () => clearInterval(statusInterval);
    // No changes needed in the polling logic itself, just ensure dependencies are minimal
  }, [renderJobId, router]); // Depends only on job ID and router

  const handleCancel = () => {
    // TODO: Implement actual job cancellation API call if available
    // For now, just redirect
    if (confirm('Are you sure you want to cancel this render? Your credit will not be refunded.')) {
      router.push('/dashboard');
    }
  };
  
  if (error) {
    const isCreditsError = error.includes('credits');
    
    return (
      <div className="container mx-auto py-8">
        <Card className="w-full max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => router.push('/dashboard/new-render')}>
              Start New Render
            </Button>
            {isCreditsError && (
              <Link href="/pricing">
                <Button>
                  Purchase Credits
                </Button>
              </Link>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Generating Your Render</h1>
      
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>AI Rendering in Progress</CardTitle>
          <CardDescription>
            Please wait while we create your visualization
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-8 flex flex-col items-center justify-center min-h-[200px]">
          {/* Simple Loader */}
          <div className="flex flex-col items-center space-y-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
            <p className="text-lg font-medium text-gray-700">
              Generating your render...
            </p>
            <p className="text-sm text-gray-500">
              Renders can take up to 5 mins. Please wait.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Please note: AI renders aim to capture the main elements and style, but may not be perfect representations.
            </p>
          </div>
          
          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md mt-8 w-full text-center">
            <p>Your credit will only be used once the render completes successfully.</p>
          </div>
        </CardContent>
        
        <CardFooter className="justify-center">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleCancel}
            className="text-gray-500"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </CardFooter>
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
      <h1 className="text-3xl font-bold mb-8">Preparing Your Render</h1>
      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      <p className="mt-4">Loading renderer...</p>
    </div>
  );
}

export default function RenderingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RenderingContent />
    </Suspense>
  );
}
