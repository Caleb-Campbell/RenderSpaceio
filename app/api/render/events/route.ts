import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getRedisClient } from '@/lib/redis';
import IORedis from 'ioredis';

// Export edge runtime if deploying to Vercel Edge Functions is intended
// export const runtime = 'edge'; // Uncomment for Vercel Edge deployment

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await getSessionUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }
  } catch (error) {
    console.error('SSE Auth Error:', error);
    return new Response('Authentication error', { status: 500 });
  }

  const userId = user.id;
  const channel = `user-events:${userId}`;
  let redisSubscriber: IORedis | null = null;

  // Create a new ReadableStream for the SSE response
  const stream = new ReadableStream({
    async start(controller) {
      console.log(`SSE: Connection opened for user ${userId}, subscribing to ${channel}`);

      // Need a dedicated Redis client for subscribing as SUBSCRIBE blocks the connection
      try {
        redisSubscriber = getRedisClient().duplicate(); // Create a dedicated subscriber client
        
        redisSubscriber.on('error', (err) => {
          console.error(`SSE: Redis Subscriber Error for user ${userId}:`, err);
          controller.error(err); // Close the stream on Redis error
          cleanup();
        });

        await redisSubscriber.subscribe(channel);
        console.log(`SSE: Subscribed to ${channel}`);

        // Listener for messages
        redisSubscriber.on('message', (subChannel, message) => {
          if (subChannel === channel) {
            console.log(`SSE: Received message on ${channel}:`, message);
            try {
              const parsedMessage = JSON.parse(message);
              // Format as SSE: data: { ... JSON ...}\n\n
              const sseFormattedMessage = `data: ${JSON.stringify(parsedMessage)}\n\n`;
              controller.enqueue(new TextEncoder().encode(sseFormattedMessage));
            } catch (parseError) {
              console.error(`SSE: Failed to parse message from ${channel}:`, parseError);
              // Optionally send an error event to the client
              // controller.enqueue(new TextEncoder().encode(`event: error\ndata: {"message": "Invalid message format"}\n\n`));
            }
          }
        });

        // Send initial confirmation message (optional)
        controller.enqueue(new TextEncoder().encode(`event: connected\ndata: {"message": "Subscribed to events"}\n\n`));

      } catch (subError) {
         console.error(`SSE: Failed to initialize Redis subscription for user ${userId}:`, subError);
         controller.error(subError);
         cleanup();
      }
    },
    cancel(reason) {
      console.log(`SSE: Connection closed for user ${userId}. Reason:`, reason);
      cleanup();
    },
  });

  const cleanup = () => {
    if (redisSubscriber) {
      console.log(`SSE: Unsubscribing and quitting Redis subscriber for user ${userId}`);
      redisSubscriber.unsubscribe(channel)
        .catch(err => console.error(`SSE: Error unsubscribing ${channel}:`, err))
        .finally(() => {
          redisSubscriber?.quit().catch(err => console.error('SSE: Error quitting Redis subscriber:', err));
          redisSubscriber = null; // Ensure it's marked as cleaned up
        });
    }
  };

  // Return the stream response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform', // Ensure no caching or buffering by proxies
      'Connection': 'keep-alive',
      // Optional: CORS headers if needed, though usually handled by Next.js config
      // 'Access-Control-Allow-Origin': '*', 
    },
  });
}
