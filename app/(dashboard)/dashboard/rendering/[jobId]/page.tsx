'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { renderJobs, RenderStatus } from '@/lib/db/schema';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';

type RenderJob = typeof renderJobs.$inferSelect;

// Function to fetch job status
async function fetchJobStatus(jobId: string): Promise<RenderJob | null> {
  try {
    const response = await fetch(`/api/render/status?id=${jobId}`);
    if (response.status === 404) {
      return null; // Job not found
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch status: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching job status:", error);
    toast.error(`Error fetching job status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null; // Indicate error or non-existence
  }
}

export default function RenderingStatusPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string; // Get jobId from URL

  const [job, setJob] = useState<RenderJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleJobUpdate = (updatedJobData: Partial<RenderJob>) => {
    console.log(`[${jobId}] Received update:`, updatedJobData);
    setJob((prevJob) => {
      if (!prevJob) return updatedJobData as RenderJob; // Should ideally not happen if initial fetch worked
      // Merge new data, ensuring status is updated correctly
      const newJob = { ...prevJob, ...updatedJobData };
      // If completed or failed, redirect after a short delay
      if (newJob.status === RenderStatus.COMPLETED || newJob.status === RenderStatus.FAILED) {
        cleanupConnections(); // Stop polling/SSE
        if (newJob.status === RenderStatus.COMPLETED) {
          console.log(`[${jobId}] Job completed, redirecting to result page...`);
          setTimeout(() => router.push(`/dashboard/result/${jobId}`), 1500); // Delay redirect slightly
        }
      }
      return newJob;
    });
  };

  const cleanupConnections = () => {
      if (eventSourceRef.current) {
        console.log(`[${jobId}] Cleaning up SSE connection.`);
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        console.log(`[${jobId}] Cleaning up polling interval.`);
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
  };

  useEffect(() => {
    if (!jobId) {
      setError("Job ID is missing.");
      setIsLoading(false);
      return;
    }

    let isMounted = true; // Flag to prevent state updates on unmounted component

    // Initial fetch
    fetchJobStatus(jobId).then(initialJob => {
      if (!isMounted) return;
      if (initialJob) {
        setJob(initialJob);
        // If already completed/failed on initial load, redirect immediately or after short delay
        if (initialJob.status === RenderStatus.COMPLETED) {
           console.log(`[${jobId}] Job already completed on load, redirecting...`);
           setTimeout(() => router.push(`/dashboard/result/${jobId}`), 1000);
        } else if (initialJob.status === RenderStatus.FAILED) {
           console.log(`[${jobId}] Job already failed on load.`);
           // No redirect for failed jobs, just display status
        } else {
           // Start SSE and polling only if job is in progress
           setupSSE();
           setupPolling();
        }
      } else {
        setError("Render job not found or access denied.");
      }
      setIsLoading(false);
    }).catch(err => {
       if (!isMounted) return;
       setError(`Failed to load job: ${err.message}`);
       setIsLoading(false);
    });

    const setupSSE = () => {
        console.log(`[${jobId}] Setting up SSE connection...`);
        if (eventSourceRef.current) return; // Avoid duplicate connections

        const eventSource = new EventSource('/api/render/events');
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => console.log(`[${jobId}] SSE connection opened.`);
        eventSource.onerror = (err) => {
            console.error(`[${jobId}] SSE connection error:`, err);
            // Don't close automatically, rely on polling as backup
            // eventSource.close();
            // eventSourceRef.current = null;
        };
        eventSource.addEventListener('message', (event) => {
            try {
                const messageData = JSON.parse(event.data);
                // Check if the event is for *this* job
                if (messageData.data?.jobId === jobId) {
                    handleJobUpdate(messageData.data);
                }
            } catch (e) {
                console.error(`[${jobId}] Failed to parse SSE message:`, e);
            }
        });
    };

    const setupPolling = () => {
        console.log(`[${jobId}] Setting up polling...`);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); // Clear existing interval

        pollIntervalRef.current = setInterval(async () => {
            // Only poll if the job is still potentially in progress
            if (job && (job.status === RenderStatus.COMPLETED || job.status === RenderStatus.FAILED)) {
                 cleanupConnections();
                 return;
            }
            const polledJob = await fetchJobStatus(jobId);
            if (polledJob) {
                // Update state only if status differs or job is newly fetched
                setJob(currentJob => {
                    if (!currentJob || JSON.stringify(currentJob) !== JSON.stringify(polledJob)) {
                        handleJobUpdate(polledJob);
                        return polledJob;
                    }
                    return currentJob;
                });
            } else {
                // Handle job not found during polling (maybe deleted?)
                setError("Render job seems to have disappeared.");
                cleanupConnections();
            }
        }, 5000); // Poll every 5 seconds
    };

    // Cleanup on component unmount
    return () => {
      isMounted = false;
      cleanupConnections();
    };
  }, [jobId, router]); // Add router to dependency array

  const getStatusContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-10">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-gray-400" />
          <p className="mt-4 text-lg text-gray-600">Loading render status...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-10 text-red-600">
          <AlertTriangle className="h-12 w-12 mx-auto" />
          <p className="mt-4 text-lg font-medium">Error</p>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      );
    }

    if (!job) {
       return (
         <div className="text-center py-10 text-gray-600">
           <AlertTriangle className="h-12 w-12 mx-auto" />
           <p className="mt-4 text-lg font-medium">Job Not Found</p>
           <p className="text-sm text-gray-500">Could not find details for this render job.</p>
         </div>
       );
    }

    switch (job.status) {
      case RenderStatus.PENDING:
        return (
          <div className="text-center py-10">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-gray-400" />
            <p className="mt-4 text-lg text-gray-600">Render is Pending</p>
            <p className="text-sm text-gray-500">Your job is waiting in the queue.</p>
          </div>
        );
      case RenderStatus.PROCESSING:
        return (
          <div className="text-center py-10">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500" />
            <p className="mt-4 text-lg text-blue-600">Generating Image</p>
            <p className="text-sm text-gray-500">The AI is working its magic...</p>
          </div>
        );
      case RenderStatus.UPLOADING:
        return (
          <div className="text-center py-10">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-purple-500" />
            <p className="mt-4 text-lg text-purple-600">Uploading Image</p>
            <p className="text-sm text-gray-500">Saving your new render...</p>
          </div>
        );
      case RenderStatus.COMPLETED:
        return (
          <div className="text-center py-10 text-green-600">
            <CheckCircle className="h-12 w-12 mx-auto" />
            <p className="mt-4 text-lg font-medium">Render Complete!</p>
            <p className="text-sm text-gray-500 mb-4">Redirecting to results page...</p>
            {job.resultImagePath && (
               <div className="relative aspect-video max-w-md mx-auto bg-gray-100 rounded overflow-hidden">
                 <Image src={job.resultImagePath} alt="Render preview" layout="fill" objectFit="contain" />
               </div>
            )}
          </div>
        );
      case RenderStatus.FAILED:
        return (
          <div className="text-center py-10 text-red-600">
            <AlertTriangle className="h-12 w-12 mx-auto" />
            <p className="mt-4 text-lg font-medium">Render Failed</p>
            <p className="text-sm text-red-500">{job.errorMessage || "An unknown error occurred."}</p>
          </div>
        );
      default:
        return <p>Unknown status: {job.status}</p>;
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Render Status</CardTitle>
          {job && <CardDescription>Tracking job: {job.title || jobId}</CardDescription>}
        </CardHeader>
        <CardContent>
          {getStatusContent()}
        </CardContent>
      </Card>
       <div className="text-center mt-6">
          <Link href="/dashboard/gallery">
             <Button variant="outline">Back to Gallery</Button>
          </Link>
       </div>
    </div>
  );
}
