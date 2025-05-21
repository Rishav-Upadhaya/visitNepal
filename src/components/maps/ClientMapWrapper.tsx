"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamically import the map component to ensure it's client-side only
const DynamicInteractiveMap = dynamic(() =>
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

const ClientMapWrapper = () => {
  return <DynamicInteractiveMap />;
};

export default ClientMapWrapper;