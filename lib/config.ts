/**
 * Feature flags and configuration
 * Note: This config is for client and server components, NOT for middleware (Edge runtime).
 * For middleware, read environment variables directly.
 */
export const config = {
  // Feature flags
  features: {
    /**
     * When true, show only the early access page after login
     * 
     * IMPORTANT: If using this in middleware.ts, read the env var directly instead:
     * const earlyAccessOnly = process.env.NEXT_PUBLIC_EARLY_ACCESS_ONLY === 'true';
     */
    earlyAccessOnly: process.env.NEXT_PUBLIC_EARLY_ACCESS_ONLY === 'true' || false,
    
    // Additional feature flags can be added here
  },
  
  // App metadata
  app: {
    name: 'RenderSpace',
    description: 'AI Interior Design Visualization',
  },
};
