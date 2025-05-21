// src/app/interactive-map/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interactive Map of Nepal | Explore Districts',
  description: 'An interactive map to explore all districts of Nepal.',
  keywords: ['Nepal Interactive Map', 'Nepal Districts Map', 'Leaflet Map Nepal', 'Explore Nepal GeoJSON', 'Nepal Geolocation Map', 'Interactive Map'],
};

export default function InteractiveMapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
