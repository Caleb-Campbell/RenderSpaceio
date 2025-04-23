'use client';

import Link from 'next/link';
import { use, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { CircleIcon, Home, LogOut, MessageSquareQuoteIcon } from 'lucide-react';
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


export default function Layout({ children }: { children: React.ReactNode }) {
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
