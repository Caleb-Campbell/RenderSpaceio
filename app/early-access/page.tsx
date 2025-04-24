'use client';

import { useState, use } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowRight, CheckCircle2, LogOut } from 'lucide-react';
import Image from 'next/image';
import { useUser } from '@/lib/auth';
import { signOut } from '@/app/(login)/actions';

export default function EarlyAccessPage() {
  const { userPromise } = useUser();
  const user = use(userPromise);
  
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/early-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit. Please try again.');
      }
      
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      console.error('Error submitting email:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle user signout
  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  // Placeholder images for carousels
  const topCarouselImages = [
    '/placeholder-1.jpg',
    '/placeholder-2.jpg',
    '/placeholder-3.jpg',
  ];
  
  const bottomCarouselImages = [
    '/placeholder-4.jpg',
    '/placeholder-5.jpg',
    // '/placeholder-render.jpg', // Removed problematic placeholder
    '/placeholder-room.jpg',
  ];

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      {/* Top carousel - moving left to right */}
      <div className="absolute top-0 w-full h-1/3 overflow-hidden opacity-20">
        <div className="animate-carousel-right flex">
          {/* Double the images to create seamless loop */}
          {[...topCarouselImages, ...topCarouselImages].map((src, i) => (
            <div key={`top-${i}`} className="min-w-[400px] h-full p-2">
              <div className="relative w-full h-full">
                <Image
                  src={src}
                  alt={`Example interior design ${i}`}
                  fill
                  sizes="400px"
                  className="object-cover rounded-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Bottom carousel - moving right to left */}
      <div className="absolute bottom-0 w-full h-1/3 overflow-hidden opacity-20">
        <div className="animate-carousel-left flex">
          {/* Double the images to create seamless loop */}
          {[...bottomCarouselImages, ...bottomCarouselImages].map((src, i) => (
            <div key={`bottom-${i}`} className="min-w-[400px] h-full p-2">
              <div className="relative w-full h-full">
                <Image
                  src={src}
                  alt={`Example interior design ${i}`}
                  fill
                  sizes="400px"
                  className="object-cover rounded-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sign up form - centered */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <Card className="max-w-md w-full mx-4 p-8 bg-card/95 backdrop-blur shadow-xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Early Access</h1>
            <p className="text-muted-foreground">
              Our revolutionary AI interior design model is coming soon. Be the first to know when it launches.
            </p>
          </div>

          {user ? (
            // Content for logged-in users
            <div className="space-y-6">
              <div className="text-center p-4 border border-border rounded-sm bg-background/50">
                <div className="flex justify-center mb-2 text-primary">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <h2 className="text-xl font-medium text-foreground mb-2">You're on the Waitlist!</h2>
                <p className="text-muted-foreground mb-4">
                  Thanks for your interest, {user.name || user.email}! We'll notify you as soon as our AI interior design tool is ready for testing.
                </p>
                <p className="text-xs text-muted-foreground">
                  Current status: In development. Expected release: Q2 2025.
                </p>
              </div>
              
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            // Content for non-logged-in users
            <>
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full"
                      disabled={loading}
                    />
                  </div>
                  {error && (
                    <div className="text-destructive text-sm py-2">{error}</div>
                  )}
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      <>
                        Join the Waitlist
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <div className="text-center text-sm text-muted-foreground">
                    We'll notify you as soon as access becomes available.
                  </div>
                </form>
              ) : (
                <div className="text-center p-4">
                  <div className="flex justify-center mb-2 text-primary">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                  <h2 className="text-xl font-medium text-foreground mb-2">Thank You!</h2>
                  <p className="text-muted-foreground">
                    You're on the list! We'll notify you when our AI interior design tool is ready.
                  </p>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
