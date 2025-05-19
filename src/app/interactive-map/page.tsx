// src/app/interactive-map/page.tsx
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamically import the map component to ensure it's client-side only
// and Leaflet's CSS is handled correctly.
const DynamicMap = dynamic(() => 
  import('@/components/maps/InteractiveDistrictMap').then(mod => mod.InteractiveDistrictMap),
  { 
    ssr: false, // Important: Leaflet needs to run on the client
    loading: () => (
        <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg">Initializing Interactive Map of Nepal...</p>
        </div>
    )
  }
);

export const metadata: Metadata = {
  title: 'Interactive Map of Nepal | Explore Districts',
  description: 'Explore Nepal\'s districts interactively. View details, get your location, and plan your visit with our advanced map tool.',
  keywords: ['Nepal Interactive Map', 'Nepal Districts Map', 'Leaflet Map Nepal', 'Explore Nepal GeoJSON', 'Nepal Geolocation Map'],
};

export default function InteractiveMapPage() {
  return (
    // The map component itself will handle full-screen styling and layout.
    // No extra layout divs are needed here for the map to be full-screen.
    <DynamicMap />
  );
}
