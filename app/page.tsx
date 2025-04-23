"use client"

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, ImagePlus, Zap, Paintbrush } from 'lucide-react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"

const examples = [
  { id: 1, before: "/examples/example_1/before/PNG image.jpeg", after: "/examples/example_1/after/41677395-C7FF-4C10-9860-54A7A9F10688.png" },
  { id: 2, before: "/examples/example_2/before/IMG_7354.JPG", after: "/examples/example_2/after/RenderSpace_Living Room_Bright.png" },
  { id: 3, before: "/examples/example_3/before/IMG_7353.JPG", after: "/examples/example_3/after/RenderSpace_Living Room_Bright.png" },
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero Section */}
      <section className="relative bg-background py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left lg:flex lg:items-center">
              <div>
                <h1 className="text-4xl font-bold text-foreground tracking-tight sm:text-5xl md:text-6xl">
                  Transform Your 
                  <span className="block text-accent">Interior Design Ideas</span>
                  Into Reality
                </h1>
                <p className="mt-3 text-base text-muted-foreground sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                  Upload your design elements and our AI will generate stunning interior space visualizations in seconds. Perfect for designers, decorators, and homeowners.
                </p>
                <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0 space-y-4 sm:space-y-0 sm:flex sm:gap-4">
                  <Link href="/sign-up">
                    <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4">
                      Get Started
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
              <Carousel
                className="relative mx-auto w-full rounded-sm shadow-lg lg:max-w-md"
                plugins={[
                  Autoplay({
                    delay: 3000, // Adjust delay as needed (milliseconds)
                    stopOnInteraction: false,
                  }),
                ]}
                opts={{
                  loop: true,
                }}
              >
                <CarouselContent>
                  {examples.map((example) => (
                    <CarouselItem key={example.id}>
                      <div className="relative block w-full bg-card rounded-sm overflow-hidden">
                        <Image
                          src={example.after}
                          alt={`Example Render ${example.id}`}
                          width={640} // Adjust dimensions as needed
                          height={360}
                          className="w-full h-auto object-cover" // Adjust styling as needed
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {/* No Previous/Next buttons here */}
              </Carousel>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-secondary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground">How It Works</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
              Create stunning interior visualizations in three simple steps
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="relative">
              <div className="absolute flex items-center justify-center h-12 w-12 rounded-sm bg-primary text-primary-foreground">
                <span className="text-xl font-bold">1</span>
              </div>
              <div className="ml-16">
                <h3 className="text-lg font-medium text-foreground">Upload Your Design Elements</h3>
                <p className="mt-2 text-base text-muted-foreground">
                  Create a collage with furniture, colors, textures, and materials you want in your space.
                </p>
                <p>
                  We recommend using something like <a href="https://www.shffls.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Shffles</a> to create your collage.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute flex items-center justify-center h-12 w-12 rounded-sm bg-primary text-primary-foreground">
                <span className="text-xl font-bold">2</span>
              </div>
              <div className="ml-16">
                <h3 className="text-lg font-medium text-foreground">Select Room Type & Lighting</h3>
                <p className="mt-2 text-base text-muted-foreground">
                  Choose your room type and preferred lighting style from our customization options.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute flex items-center justify-center h-12 w-12 rounded-sm bg-primary text-primary-foreground">
                <span className="text-xl font-bold">3</span>
              </div>
              <div className="ml-16">
                <h3 className="text-lg font-medium text-foreground">Get Your AI Visualization</h3>
                <p className="mt-2 text-base text-muted-foreground">
                  Our AI generates a high-quality, realistic render of your interior design concept.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            <div>
              <div className="flex items-center justify-center h-12 w-12 rounded-sm bg-primary text-primary-foreground">
                <ImagePlus className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h3 className="text-lg font-medium text-foreground">
                  High-Quality Renders
                </h3>
                <p className="mt-2 text-base text-muted-foreground">
                  Generate professional-grade visualizations at 1024x1024 resolution with realistic lighting and textures.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-sm bg-primary text-primary-foreground">
                <Zap className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h3 className="text-lg font-medium text-foreground">
                  Fast Results
                </h3>
                <p className="mt-2 text-base text-muted-foreground">
                  Get your visualization in minutes, saving hours of traditional rendering time.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-sm bg-primary text-primary-foreground">
                <Paintbrush className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h3 className="text-lg font-medium text-foreground">
                  Design Freedom
                </h3>
                <p className="mt-2 text-base text-muted-foreground">
                  Mix and match any design elements, colors, and styles to visualize your unique interior concepts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground">Simple, Transparent Pricing</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
              Pay only for what you need with our credit-based system
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-3xl mx-auto">
            <div className="border border-border bg-card rounded-sm p-6 shadow-sm">
              <h3 className="text-lg font-medium text-foreground">1 Credit</h3>
              <p className="mt-4 text-3xl font-bold text-foreground">$1</p>
              <p className="mt-1 text-sm text-muted-foreground">per render</p>
              <Link href="/pricing" className="mt-6 block w-full">
                <Button variant="outline" className="w-full">
                  Buy Credits
                </Button>
              </Link>
            </div>

            <div className="border border-primary bg-card rounded-sm p-6 shadow-md relative">
              <div className="absolute top-0 inset-x-0 transform -translate-y-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-sm">
                  MOST POPULAR
                </span>
              </div>
              <h3 className="text-lg font-medium text-foreground">5 Credits</h3>
              <p className="mt-4 text-3xl font-bold text-foreground">$4</p>
              <p className="mt-1 text-sm text-muted-foreground">$0.80 per render (20% off)</p>
              <Link href="/pricing" className="mt-6 block w-full">
                <Button className="w-full bg-primary hover:bg-primary/90">
                  Buy Credits
                </Button>
              </Link>
            </div>

            <div className="border border-border bg-card rounded-sm p-6 shadow-sm">
              <h3 className="text-lg font-medium text-foreground">10 Credits</h3>
              <p className="mt-4 text-3xl font-bold text-foreground">$8</p>
              <p className="mt-1 text-sm text-muted-foreground">$0.80 per render (20% off)</p>
              <Link href="/pricing" className="mt-6 block w-full">
                <Button variant="outline" className="w-full">
                  Buy Credits
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/pricing">
              <Button className="bg-background hover:bg-secondary/20 text-foreground border border-border">
                View All Pricing Options
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-primary-foreground sm:text-4xl">
                Ready to transform your interior design ideas?
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-primary-foreground/80">
                Get started today and create your first visualization in minutes.
              </p>
            </div>
            <div className="mt-8 lg:mt-0 flex justify-center lg:justify-end">
              <Link href="/sign-up">
                <Button className="bg-background hover:bg-background/90 text-primary border border-transparent rounded-sm px-8 py-3 text-lg font-medium shadow-sm">
                  Sign Up Now
                  <ArrowRight className="ml-3 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
