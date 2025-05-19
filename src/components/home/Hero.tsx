
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton for loading state

// Lazy load the map component
const HomepageMapWithNoSSR = dynamic(
  () => import('@/components/maps/HomepageMap').then((mod) => mod.HomepageMap),
  { 
    ssr: false,
    loading: () => (
      <div className="aspect-[16/7] w-full bg-muted rounded-xl flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Loading Map...</p>
      </div>
    )
  }
);

export function Hero() {
  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container text-center">
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

      <div className="container mt-16 md:mt-24">
        {/* Interactive Map Section */}
        <div className="bg-muted/10 p-4 md:p-6 rounded-xl shadow-2xl border border-primary/10">
          <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-4">
            Interactive Map of Nepal
          </h2>
          <p className="text-center text-muted-foreground mb-6 max-w-2xl mx-auto">
            Click on provinces or major cities to discover more. Zoom and pan to explore the geography of Nepal.
            (Data loads from a sample GeoJSON and mock Firestore data for now).
          </p>
          <HomepageMapWithNoSSR />
        </div>
      </div>
    </section>
  );
}
