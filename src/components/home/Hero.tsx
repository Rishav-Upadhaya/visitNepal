
"use client"; 

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load the map component
const HomepageMapWithNoSSR = dynamic(
  () => import('@/components/maps/HomepageMap').then((mod) => mod.HomepageMap),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-[16/9] w-full h-full bg-muted/30 rounded-xl flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Loading Interactive Map...</p>
      </div>
    )
  }
);

export function Hero() {
  return (
    <section className="bg-background">
      {/* Frame 1: Title, Description, CTA */}
      <div className="min-h-screen flex flex-col justify-center items-center text-center container py-12 md:py-20">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-primary leading-tight">
          Explore the Majestic Beauty of Nepal
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          Journey through breathtaking landscapes, ancient cultures, and thrilling adventures. Your unforgettable Himalayan experience starts here. Plan your travel or tour to Nepal today!
        </p>
        <Button asChild size="lg" className="mt-10 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg px-10 py-6 text-lg">
          <Link href="/plan-trip" prefetch={true}>
            Plan Your Adventure
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>

      {/* Frame 2: Interactive Map Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div
          className="bg-muted/10 dark:bg-muted/20 p-4 md:p-6 rounded-xl 
                        h-auto sm:aspect-video md:h-[400px] lg:h-[500px] flex flex-col items-center" // Added items-center
        >
          <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-4">
            Discover Nepal: An Interactive Overview
          </h2>
          <p className="text-center text-muted-foreground mb-6 max-w-2xl mx-auto">
            Click on districts or highlighted major cities on the map below to explore detailed information and start planning your unique journey!
          </p>
          <div className="flex-grow w-full h-full min-h-[300px] sm:min-h-0">
            <HomepageMapWithNoSSR />
          </div>
        </div>
      </div>
    </section>
  );
}
