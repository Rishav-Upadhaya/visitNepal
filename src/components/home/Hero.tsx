
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
      <div className="aspect-[16/9] w-full h-full bg-muted/10 rounded-xl flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Loading Interactive Map of Nepal...</p>
      </div>
    )
  }
);

export function Hero() {
  return (
    <section className="bg-background">
      {/* Frame 1: Title, Description, CTA */}
      <div className="flex flex-col justify-center items-center text-center animate-fadeInUp">
        <div className="container px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-primary leading-tight animate-fadeInUp animation-delay-200">
            Explore the Majestic Beauty of Nepal
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto animate-fadeInUp animation-delay-400">
            Journey through breathtaking landscapes, ancient cultures, and thrilling adventures. Your unforgettable Himalayan experience starts here. Plan your travel or tour to Nepal today!
          </p>
          <Button asChild size="lg" className="mt-10 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg px-10 py-6 text-lg animate-fadeInUp animation-delay-600">
            <Link href="/plan-trip" prefetch={true}>
              Plan Your Adventure
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Frame 2: Interactive Map Section */}
      <div className="flex flex-col justify-center items-center bg-muted/30 py-12 md:py-20 animate-fadeInUp animation-delay-700">
        <div 
            className="container flex flex-col items-center text-center 
                       w-full max-w-4xl 
                       min-h-[400px] sm:aspect-video sm:h-auto md:h-[500px] lg:h-[600px]
                       bg-card p-4 sm:p-6 md:p-8 rounded-xl shadow-xl"
        >
          <MapPin className="h-10 w-10 md:h-12 md:w-12 text-primary mb-3 md:mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2 md:mb-3">
            Discover Nepal: An Interactive Overview
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 max-w-xl mx-auto">
            Click on districts or highlighted major cities on the map below to explore detailed information and start planning your unique journey through Nepal!
          </p>
          <div className="relative w-full flex-grow rounded-xl overflow-hidden border border-border">
            {/* This inner div will be filled by the map component */}
            <HomepageMapWithNoSSR />
          </div>
        </div>
      </div>
    </section>
  );
}
