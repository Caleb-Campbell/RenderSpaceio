'use client';

import Link from 'next/link';
import { use, useState, Suspense, useEffect, useRef } from 'react'; // Added useEffect, useRef
import { Button } from '@/components/ui/button';
import { CircleIcon, Home, LogOut, MessageSquareQuoteIcon, CheckCircle, XCircle, ExternalLink } from 'lucide-react'; // Added icons for toast
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/lib/auth';
import { signOut } from '@/app/(login)/actions';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { usePostHog } from 'posthog-js/react';
import toast from 'react-hot-toast'; // Added toast import

function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { userPromise } = useUser();
  const user = use(userPromise);
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.refresh();
    router.push('/');
  }

  if (!user) {
    return (
      <>
        <Link
          href="/pricing"
          className="text-sm font-medium text-foreground hover:text-primary"
        >
          Pricing
        </Link>
        <Button
          asChild
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm px-4 py-2"
        >
          <Link href="/sign-up">Sign Up</Link>
        </Button>
      </>
    );
  }

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger>
        <Avatar className="cursor-pointer size-9">
          <AvatarImage alt={user.name || ''} />
          <AvatarFallback>
            {user.email
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex flex-col gap-1">
        <DropdownMenuItem className="cursor-pointer">
          <Link href="/dashboard" className="flex w-full items-center">
            <Home className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <form action={handleSignOut} className="w-full">
          <button type="submit" className="flex w-full">
            <DropdownMenuItem className="w-full flex-1 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header() {
  return (
    <header className="border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <Image src="/favicon.ico" alt="RenderSpace" width={32} height={32} />
          <span className="ml-2 text-xl font-semibold text-foreground">RenderSpace</span>
        </Link>
        <div className="flex items-center space-x-4">
          <Suspense fallback={<div className="h-9" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t border-border mt-auto py-4 text-center text-sm text-muted-foreground">
      © {currentYear} RenderSpace. All rights reserved.
    </footer>
  );
}

function SupportButton() {
  const posthog = usePostHog();

  const handleSupportClick = () => {
    // Capture an event. Configure a PostHog survey/widget
    // to trigger based on this event in your PostHog project settings.
    posthog?.capture('support_widget_opened');

    // Alternatively, if using the standard PostHog toolbar for feedback:
    // posthog?.loadToolbar({ props: { temporaryToken: 'YOUR_TEMP_TOKEN' } });
    // Replace 'YOUR_TEMP_TOKEN' if needed, or remove props if not.
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg"
      onClick={handleSupportClick}
      aria-label="Support"
    >
      <MessageSquareQuoteIcon className="h-5 w-5" />
    </Button>
  );
}

// Define the expected structure of the SSE message data
interface RenderEventData {
  jobId: string;
  title: string;
  status: 'COMPLETED' | 'FAILED';
  resultImageUrl?: string;
  errorMessage?: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const { userPromise } = useUser(); // Get user promise to check auth status
  const user = use(userPromise); // Resolve user promise

  useEffect(() => {
    // Only establish SSE connection if the user is logged in
    if (!user) {
      console.log('SSE: User not logged in, skipping connection.');
      return;
    }

    console.log('SSE: Attempting to establish connection...');
    // Ensure only one connection is active
    if (eventSourceRef.current) {
      console.log('SSE: Connection already exists, skipping.');
      return;
    }

    const eventSource = new EventSource('/api/render/events');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE: Connection opened successfully.');
    };

    eventSource.onerror = (error) => {
      console.error('SSE: Connection error:', error);
      // Optionally show a persistent error toast or attempt reconnection logic
      // toast.error('Real-time connection lost. Please refresh.', { id: 'sse-error' });
      eventSource.close(); // Close on error to prevent constant retries by browser
      eventSourceRef.current = null;
    };

    eventSource.addEventListener('message', (event) => {
      console.log('SSE: Message received:', event.data);
      try {
        const messageData = JSON.parse(event.data) as { event: string; data: RenderEventData };

        if (messageData.event === 'render.completed') {
          const { jobId, title, resultImageUrl } = messageData.data;
          toast.custom(
            (t) => (
              <div
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
              >
                <div className="flex-1 w-0 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5 text-green-500">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Render Complete!
                      </p>
                      <p className="mt-1 text-sm text-gray-500 truncate">
                        "{title}" is ready.
                      </p>
                      {resultImageUrl && (
                         <div className="mt-2">
                            <Link href={`/dashboard/result/${jobId}`} passHref legacyBehavior>
                              <a
                                onClick={() => toast.dismiss(t.id)}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                              >
                                View Result <ExternalLink className="ml-1 h-3 w-3" />
                              </a>
                            </Link>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex border-l border-gray-200">
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-orange-600 hover:text-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            ),
            { duration: 10000 } // Keep toast longer
          );
        } else if (messageData.event === 'render.failed') {
          const { title, errorMessage } = messageData.data;
           toast.error(
             `Render failed for "${title}". ${errorMessage ? `Reason: ${errorMessage}` : ''}`,
             {
               icon: <XCircle className="h-6 w-6 text-red-500" />,
               duration: 8000, // Keep error toast longer
             }
           );
        }
      } catch (error) {
        console.error('SSE: Failed to parse message data:', error);
      }
    });

    // Cleanup function to close connection when component unmounts or user logs out
    return () => {
      if (eventSourceRef.current) {
        console.log('SSE: Closing connection.');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [user]); // Re-run effect if user auth state changes

  return (
    <section className="flex flex-col min-h-screen relative">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
      <Suspense fallback={null}> {/* Ensure PostHog is loaded */}
        <SupportButton />
      </Suspense>
    </section>
  );
}
