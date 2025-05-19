
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react'; // Removed Map icon as the image will be the map

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
        {/* Updated Map Section */}
        <div className="relative aspect-[16/7] bg-muted/50 rounded-xl shadow-2xl overflow-hidden border">
          <Image
            src="https://placehold.co/1200x525.png" // Placeholder for a 2D map of Nepal
            alt="Stylized 2D map of Nepal showing its diverse geography and key regions for travel and tourism"
            data-ai-hint="Nepal map" // Specific hint for sourcing a real 2D map image
            fill
            className="object-contain" // Ensure the whole map is visible
            priority
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/60 via-black/30 to-transparent p-4 md:p-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">Interactive 2D Map of Nepal</h2>
            <p className="mt-3 text-md md:text-lg text-white/90 max-w-xl drop-shadow-md">
              (Coming Soon) Explore districts, landmarks, and points of interest across all parts of Nepal.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
