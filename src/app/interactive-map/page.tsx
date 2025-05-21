// src/app/interactive-map/page.tsx
"use client"; 

// Removed: import type { Metadata } from 'next';
import ClientMapWrapper from '@/components/maps/ClientMapWrapper';
import { Loader2 } from 'lucide-react'; // Assuming Loader2 might be needed for the dynamic import's loading state
import dynamic from 'next/dynamic';

// The prompt mentioned the error for a component named DynamicMap,
// and the initial file structure used ClientMapWrapper directly.
// If ClientMapWrapper itself handles dynamic import of Leaflet and shows a loader,
// then we just use ClientMapWrapper.
// If the page was supposed to dynamically import InteractiveDistrictMap (which is what ClientMapWrapper does),
// we need to ensure that dynamic import logic is here if not in ClientMapWrapper.
// For now, sticking to the simpler direct import of ClientMapWrapper as per last known state.
// If ClientMapWrapper is just a simple wrapper and InteractiveDistrictMap is the one needing ssr:false,
// then the dynamic import should be here.

// Removed metadata export:
// export const metadata: Metadata = {
//   title: 'Interactive Map of Nepal | Explore Districts',
//   description: 'Explore Nepal\'s districts interactively. View details, get your location, and plan your visit with our advanced map tool.',
//   keywords: ['Nepal Interactive Map', 'Nepal Districts Map', 'Leaflet Map Nepal', 'Explore Nepal GeoJSON', 'Nepal Geolocation Map'],
// };

export default function InteractiveMapPage() {
  return (
    // The map component itself will handle full-screen styling and layout.
    // No extra layout divs are needed here for the map to be full-screen.
    <ClientMapWrapper />
  );
}
