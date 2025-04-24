import IORedis from 'ioredis';

// TODO: Load Redis URL from environment variable (process.env.REDIS_URL)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create a single Redis client instance to be shared
// Note: IORedis instances are suitable for both regular commands and Pub/Sub
let redisClient: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!redisClient) {
    console.log('Initializing shared Redis client...');
    redisClient = new IORedis(redisUrl, {
      // Options specific to pub/sub or general use if needed
      maxRetriesPerRequest: null, // Recommended for pub/sub stability
      enableReadyCheck: false, // Often useful with pub/sub
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      // Prevent crashing the app if Redis connection fails temporarily
    });

    redisClient.on('connect', () => {
      console.log('Shared Redis client connected.');
    });

    redisClient.on('ready', () => {
        console.log('Shared Redis client ready.');
    });

    // Optional: Handle graceful shutdown if needed elsewhere
    // process.on('SIGINT', async () => { ... });
    // process.on('SIGTERM', async () => { ... });
  }
  return redisClient;
}

// Function to specifically get a duplicate connection for subscribing
// This prevents blocking the main client if needed, though IORedis handles multiplexing well.
// For simplicity now, we'll use the shared client for both publishing and subscribing.
// export function getRedisSubscriberClient(): IORedis {
//   return getRedisClient().duplicate();
// }

// Function to publish messages
export async function publishToUserChannel(userId: number | string, event: string, data: any) {
  const client = getRedisClient();
  const channel = `user-events:${userId}`;
  const message = JSON.stringify({ event, data });
  try {
    await client.publish(channel, message);
    console.log(`Published to ${channel}: ${message}`);
  } catch (error) {
    console.error(`Failed to publish to ${channel}:`, error);
  }
}
