
"use client"; 

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react'; // Changed from Map to MapPin for a more modern feel
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
      <div className="min-h-screen flex flex-col justify-center items-center bg-muted/30 py-12 md:py-20"> {/* Added bg-muted/30 for section consistency */}
        <div className="container flex flex-col items-center text-center"> {/* Added container for consistent padding */}
          <div
            className="bg-card dark:bg-card p-4 sm:p-6 md:p-8 rounded-xl shadow-xl
                        w-full max-w-5xl 
                        sm:aspect-video md:aspect-auto md:h-auto
                        flex flex-col items-center" 
          >
            <MapPin className="h-12 w-12 text-primary mb-4" /> {/* Added an icon */}
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-3">
              Discover Nepal: An Interactive Overview
            </h2>
            <p className="text-center text-muted-foreground mb-6 max-w-2xl mx-auto text-base md:text-lg">
              Click on districts or highlighted major cities on the map below to explore detailed information and start planning your unique journey through Nepal!
            </p>
            <div className="w-full h-[300px] sm:h-[400px] md:h-[500px] lg:h-[550px] min-h-[300px]"> {/* Responsive height for map container */}
              <HomepageMapWithNoSSR />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
