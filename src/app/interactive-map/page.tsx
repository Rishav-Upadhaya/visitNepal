// src/app/interactive-map/page.tsx
"use client"; // Add this directive

import type { Metadata } from 'next';
import ClientMapWrapper from '@/components/maps/ClientMapWrapper';

export const metadata: Metadata = {
  // @ts-ignore - metadata is not used in a client component, this is for the server render
  // The actual metadata for the page will be defined in a layout file or a server component
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
