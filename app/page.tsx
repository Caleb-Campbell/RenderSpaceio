"use client"

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, ImagePlus, Zap, Paintbrush } from 'lucide-react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel" // Re-added Carousel imports
import Autoplay from "embla-carousel-autoplay" // Re-added Autoplay

// The desired list of examples with utfs.io URLs
const examples = [
  {
    id: 1,
    before: "https://utfs.io/f/VSzDhtn7Jw1jsxSlKrGWUf835ag0KMxZcl1doybrG2uAzmTS",
    after: "https://utfs.io/f/VSzDhtn7Jw1jSubSCjHoZqWjTMkQGRe7fwl9vdhcHD0ObYsC"
  },
  // {
  //   id: 2,
  //   before: "https://utfs.io/f/VSzDhtn7Jw1jJyyblX4bGEzZDmdxUYAfiN1y4WSaotMqhQws",
  //   after: "https://utfs.io/f/VSzDhtn7Jw1jdNNuUwE7Fu9bTQAPx4EWv5lZ8HodGVwzsm0L"
  // },
  // {
  //   id: 3,
  //   before: "https://utfs.io/f/VSzDhtn7Jw1jmzrCItT31hf9LnTsQ5bF8YqZkxIvHJRtDW6A",
  //   after: "https://utfs.io/f/VSzDhtn7Jw1jwa1Dif7uVUxSKCvOPXrlJgcyGbtkzA08LwM4"
  // },
  // {
  //   id: 4,
  //   before: "https://utfs.io/f/VSzDhtn7Jw1jwlnyaV7uVUxSKCvOPXrlJgcyGbtkzA08LwM4",
  //   after: "https://utfs.io/f/VSzDhtn7Jw1jUIIIVSj1buci72CpkV3d6xDQlNSJR0jgzA9P"
  // },
  {
    id: 5,
    before: "https://utfs.io/f/VSzDhtn7Jw1jgZbVciBUc5ZFrd9p7E0na6lQIyH4bokNMfhx",
    after: "https://utfs.io/f/VSzDhtn7Jw1jQ9joOSeClSUzWYR3IFra72KD9kyhT4LmZu0t"
  },
  {
    id: 6,
    before: "https://utfs.io/f/VSzDhtn7Jw1jIv55bLhMDkVetJH3AWmr8FnyPu4XcTzo1jGx",
    after: "https://utfs.io/f/VSzDhtn7Jw1js1jlubGWUf835ag0KMxZcl1doybrG2uAzmTS"
  },
  {
    id: 7,
    before: "https://utfs.io/f/VSzDhtn7Jw1jIQbPJyMDkVetJH3AWmr8FnyPu4XcTzo1jGxi",
    after: "https://utfs.io/f/VSzDhtn7Jw1jUrzp9U1buci72CpkV3d6xDQlNSJR0jgzA9PT"
  },
  {
    id: 8,
    before: "https://utfs.io/f/VSzDhtn7Jw1jABF2tQBTQWgxntUJwXCj7f5EHv4BT0zOiarP",
    after: "https://utfs.io/f/VSzDhtn7Jw1jOLcc1us1vKTU3MN5AIyclD90ErwtjGFQskC6"
  }
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
                  Upload your design collages from Photoshop, Canva, or any design tool. Our AI transforms them into stunning, realistic interior space visualizations in seconds. Perfect for designers, decorators, and homeowners.
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
            {/* Auto-Scrolling Examples Carousel */}
            <div className="mt-12 lg:mt-0 lg:col-span-6">
              {examples.length > 0 && (
                <Carousel
                  className="w-full" // Take full width of the column
                  plugins={[
                    Autoplay({
                      delay: 2500, // Adjust speed (milliseconds)
                      stopOnInteraction: false, // Continue playing even if user interacts
                      stopOnMouseEnter: true, // Pause when mouse hovers
                    }),
                  ]}
                  opts={{
                    align: "start",
                    loop: true,
                  }}
                >
                  <CarouselContent className="-ml-4"> {/* Adjust margin based on item padding */}
                    {examples.map((example) => (
                      <CarouselItem key={example.id} className="pl-4 md:basis-1/1 lg:basis-1/1"> {/* Show one full item at a time */}
                        {/* Individual Example Card (Before & After) */}
                        <div className="bg-card rounded-lg shadow-lg p-3">
                          <div className="flex flex-col gap-3">
                            {/* Before Image */}
                            <div className="relative w-full aspect-video rounded-md overflow-hidden">
                            <Image
                              src={example.before}
                              alt={`Example ${example.id} Before`}
                              layout="fill"
                              objectFit="contain"
                              className="bg-gray-100"
                            />
                            <span className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
                              Before
                            </span>
                          </div>
                          {/* After Image */}
                          <div className="relative w-full aspect-video rounded-md overflow-hidden">
                            <Image
                              src={example.after}
                              alt={`Example ${example.id} After`}
                              layout="fill"
                              objectFit="contain"
                              className="bg-gray-100"
                            />
                            <span className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
                              After
                            </span>
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                    ))}
                  </CarouselContent>
                  {/* Removed Previous/Next buttons for continuous scroll */}
                </Carousel>
              )}
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
                  Import your design collages directly from Photoshop, Canva, or any design tool. We'll process and beautify your renders, maintaining your creative vision while enhancing the final result.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  We support various formats including PSD, PNG, JPG, and PDF files.
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
                  Universal Design Tool Support
                </h3>
                <p className="mt-2 text-base text-muted-foreground">
                  Seamlessly import and enhance designs from Photoshop, Canva, and other popular design tools. We preserve your creative vision while adding photorealistic quality.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-sm bg-primary text-primary-foreground">
                <Zap className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h3 className="text-lg font-medium text-foreground">
                  Intelligent Enhancement
                </h3>
                <p className="mt-2 text-base text-muted-foreground">
                  Our AI automatically beautifies your renders with professional-grade lighting, textures, and atmospheric details while maintaining your design choices.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-sm bg-primary text-primary-foreground">
                <Paintbrush className="h-6 w-6" />
              </div>
              <div className="mt-5">
                <h3 className="text-lg font-medium text-foreground">
                  Creative Freedom
                </h3>
                <p className="mt-2 text-base text-muted-foreground">
                  Work with your preferred design tools and workflows. Import collages, mood boards, or individual elements - we'll transform them into stunning visualizations.
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
