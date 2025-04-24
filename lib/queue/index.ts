import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { executeRenderPipeline } from '../render'; // We will create this function later

// Use the environment variable, fallback to localhost only if not set
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // Important for BullMQ
});

// Define the queue name
const RENDER_QUEUE_NAME = 'renderQueue';

// Create the queue instance
export const renderQueue = new Queue(RENDER_QUEUE_NAME, { connection });

// Define and export the job data interface
export interface RenderJobData {
  jobId: string;
}

// Create the worker instance
// The worker processes jobs from the queue
export const renderWorker = new Worker<RenderJobData>(
  RENDER_QUEUE_NAME,
  async (job: Job<RenderJobData>) => {
    // Pass the entire job object to the pipeline
    console.log(`Processing job ${job.id} with data:`, job.data);
    try {
      // Pass the entire job object now
      const result = await executeRenderPipeline(job); 
      console.log(`Job ${job.id} completed successfully.`);
      return result; // Return value is stored in the job object
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      // Throwing the error will mark the job as failed and allow for retries
      throw error;
    }
  },
  { 
    connection,
    lockDuration: 300000, // 5 minutes
    stalledInterval: 60000, // 1 minute
    // maxStalledCount: 3 // Optional: Consider adding this later if needed
  }
);

// Event listeners for the worker (optional but useful for logging/monitoring)
renderWorker.on('completed', (job, result) => {
  console.log(`Worker: Job ${job.id} completed. Result:`, result);
});

renderWorker.on('failed', (job, err) => {
  console.error(`Worker: Job ${job?.id} failed with error:`, err.message);
});

renderWorker.on('error', err => {
  console.error('Worker encountered an error:', err);
});

console.log('Render worker started.');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing worker and queue connections...');
  await renderWorker.close();
  await renderQueue.close();
  await connection.quit();
  console.log('Connections closed.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing worker and queue connections...');
  await renderWorker.close();
  await renderQueue.close();
  await connection.quit();
  console.log('Connections closed.');
  process.exit(0);
});
