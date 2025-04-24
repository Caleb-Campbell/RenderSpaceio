import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { UserProvider } from '@/lib/auth';
import { getUser } from '@/lib/db/queries';
import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { extractRouterConfig } from 'uploadthing/server';
import { uploadRouter } from '@/lib/uploadthing';
import { PostHogProvider } from '@/components/PostHogProvider';
import { Toaster } from 'react-hot-toast'; // Added Toaster import

export const metadata: Metadata = {
  title: 'RenderSpace - AI Interior Design Visualization',
  description: 'Transform your interior design collages into stunning visualizations using AI.',
};

export const viewport: Viewport = {
  maximumScale: 1,
};

const manrope = Manrope({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userPromise = getUser();

  return (
    <html
      lang="en"
      className={`bg-background text-foreground ${manrope.className}`}
    >
      <body className="min-h-[100dvh] bg-background">
        <NextSSRPlugin
          /**
           * The `extractRouterConfig` will extract **only** the route configs
           * from the router to prevent additional information from being
           * leaked to the client.
           */
          routerConfig={extractRouterConfig(uploadRouter)}
        />
        <PostHogProvider>
          <UserProvider userPromise={userPromise}>
            {children}
            <Toaster position="bottom-right" /> {/* Added Toaster component */}
          </UserProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
