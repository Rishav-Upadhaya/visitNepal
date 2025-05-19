
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Map } from 'lucide-react';

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
        <div className="relative aspect-[16/7] bg-muted/50 rounded-xl shadow-2xl overflow-hidden group p-4 md:p-8 flex flex-col items-center justify-center text-center border">
           {/* Map Icon can be kept or removed depending on whether the placeholder image clearly shows a map */}
           {/* <Map className="h-12 w-12 md:h-16 md:w-16 text-primary mb-4 md:mb-6 opacity-50" />  */}
           <div className="absolute inset-0">
             <Image
              src="https://placehold.co/1200x525.png" // Aspect ratio closer to 16/7
              alt="Map of Nepal showing its diverse geography and key regions for travel and tourism"
              data-ai-hint="Nepal map geography"
              fill
              className="object-contain" // Use 'contain' to ensure the whole map is visible
              priority
            />
           </div>
           {/* Overlay text on top of the map image */}
           <div className="relative z-10 p-4 bg-black/30 rounded-lg backdrop-blur-sm">
             <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">Interactive Map of Nepal</h2>
             <p className="mt-2 text-sm md:text-base text-white/90 max-w-xl drop-shadow-md">
              (Coming Soon) Click to explore Nepal's districts, landmarks, and points of interest for your travel planning.
             </p>
           </div>
        </div>
      </div>
    </section>
  );
}
