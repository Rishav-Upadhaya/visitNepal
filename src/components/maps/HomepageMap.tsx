
"use client";

import type { GeoJSON } from '@/types';
import { db } from '@/lib/firebase'; // Assuming you have firebase initialized here
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { MapPin, Users, InfoIcon, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
  type GeographyProps
} from 'react-simple-maps';

// TODO: Replace this with the actual path to your GeoJSON file for Nepal's provinces
// This GeoJSON should be stored in your /public folder or fetched from a URL/API.
// For this example, we'll use a placeholder URL. You should replace this with your actual data source.
const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // You need to create this file

interface ProvinceFeatureProperties {
  NAME_1: string; // Adjust property names based on your GeoJSON
  [key: string]: any;
}

interface ProvinceMapData extends ProvinceFeatureProperties {
  id: string;
  name: string;
  population?: number; // Will be fetched from Firestore
}

interface CityMapData {
  id: string;
  name: string;
  coordinates: [number, number];
  population?: number; // Will be fetched from Firestore
  provinceId?: string;
}

const majorCities: CityMapData[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], provinceId: "bagmati" },
  { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], provinceId: "gandaki" },
  { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], provinceId: "lumbini" },
  // Add more major cities with their provinceId if needed
];

export function HomepageMap() {
  const [tooltipContent, setTooltipContent] = React.useState<ProvinceMapData | CityMapData | null>(null);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [popoverTarget, setPopoverTarget] = React.useState<EventTarget | null>(null);
  const [mapData, setMapData] = React.useState<GeoJSON.Feature[] | null>(null);
  const [provincePopulations, setProvincePopulations] = React.useState<Record<string, number>>({});
  const [cityPopulations, setCityPopulations] = React.useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch GeoJSON for provinces
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) throw new Error(`Failed to fetch GeoJSON: ${geoRes.statusText}`);
        const geoData = await geoRes.json();
        // Assuming the GeoJSON is a FeatureCollection and its features are in `geoData.features`
        // or if it's TopoJSON, it might be in `geoData.objects.your_object_name.geometries`
        // For react-simple-maps, you pass the objects directly to Geographies
        setMapData(geoData.objects.nepal_provinces.geometries); // Adjust if your TopoJSON structure is different

        // Fetch population data from Firestore (Example structure)
        // Provinces
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provPopData: Record<string, number> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          // Assuming doc.id is like "bagmati_province" and geoJSON property is "Bagmati Province"
          // You'll need a consistent way to map Firestore doc ID or a field to GeoJSON properties
          provPopData[data.name.toLowerCase().replace(' province','').replace(' ','_')] = data.population;
        });
        setProvincePopulations(provPopData);

        // Cities
        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityPopData: Record<string, number> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          cityPopData[doc.id] = doc.data().population;
        });
        setCityPopulations(cityPopData);

      } catch (error) {
        console.error("Error loading map data:", error);
        setTooltipContent({ id: 'error', name: 'Error loading map data', population: 0 });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGeographyClick = (geo: GeographyProps, event: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    const properties = geo.properties as ProvinceFeatureProperties;
    // Use a consistent key for province name, e.g., properties.NAME_1 or a custom ID from your GeoJSON
    const provinceId = properties.ADM1_EN?.toLowerCase().replace(/\s+/g, '_') || properties.DIST_EN?.toLowerCase().replace(/\s+/g, '_') || `province_${properties.OBJECTID}`;
    const provinceName = properties.ADM1_EN || properties.DIST_EN || "Unknown Province";

    setTooltipContent({
      id: provinceId,
      name: provinceName,
      population: provincePopulations[provinceId] || undefined, // Fetch from state
      ...properties
    });
    setPopoverTarget(event.currentTarget);
    setPopoverOpen(true);
  };

  const handleMarkerClick = (city: CityMapData, event: React.MouseEvent<SVGGElement, MouseEvent>) => {
    setTooltipContent({
      ...city,
      population: cityPopulations[city.id] || undefined, // Fetch from state
    });
    setPopoverTarget(event.currentTarget);
    setPopoverOpen(true);
  };


  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }
  
  if (!mapData) {
    return <div className="text-center py-10 text-destructive">Failed to load map data. Please ensure <code>public/data/nepal-provinces-topo.json</code> exists and is correctly formatted, and that Firestore data is available.</div>;
  }


  return (
    <div className="relative aspect-[16/9] w-full bg-muted/30 rounded-lg shadow-lg overflow-hidden border border-primary/20">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          {/* Dummy trigger, actual trigger is map interaction */}
          <button ref={(node) => { if (node && popoverTarget === node.firstChild) setPopoverTarget(node.firstChild); }} style={{ display: 'none' }} />
        </PopoverTrigger>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 4500, // Adjust scale to fit Nepal
            center: [84.1240, 28.3949] // Center of Nepal
          }}
          style={{ width: "100%", height: "100%" }}
          aria-label="Interactive map of Nepal"
        >
          <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
            <Geographies geography={mapData}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const properties = geo.properties as ProvinceFeatureProperties;
                  const provinceIdFromGeo = properties.ADM1_EN?.toLowerCase().replace(/\s+/g, '_') || properties.DIST_EN?.toLowerCase().replace(/\s+/g, '_') || `province_${properties.OBJECTID}`;
                  const isSelected = tooltipContent?.id === provinceIdFromGeo && tooltipContent?.type !== "City";

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={(event) => handleGeographyClick(geo as GeographyProps, event)}
                      className={cn(
                        "fill-muted-foreground/30 stroke-background outline-none transition-all duration-150 ease-in-out",
                        "hover:fill-accent/70 cursor-pointer",
                        isSelected ? "fill-accent stroke-accent-foreground" : "hover:fill-accent/50"
                      )}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', fill: "hsl(var(--accent))", stroke: "hsl(var(--accent-foreground))", strokeWidth: 0.75 },
                        pressed: { outline: 'none', fill: "hsl(var(--accent))", stroke: "hsl(var(--accent-foreground))" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
            {majorCities.map(city => (
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                onClick={(event) => handleMarkerClick(city, event)}
              >
                <circle r={5} className="fill-primary stroke-primary-foreground stroke-2 cursor-pointer hover:fill-accent transition-colors" />
                <title>{city.name}</title> {/* Basic HTML tooltip on hover */}
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
        {tooltipContent && popoverTarget && (
          <PopoverContent
            className="w-64 shadow-xl border-primary/30 bg-background p-4 rounded-lg"
            side="right"
            align="start"
            // This is a bit of a hack to make Popover attach to the SVG element clicked
            // For better placement, you might need a more complex solution or a different tooltip library
            // that works better with SVG targets.
            onOpenAutoFocus={(e) => e.preventDefault()} // Prevents focus shift that can close popover
            // @ts-ignore - PopoverContent doesn't officially support a target ref this way
            // but it can work for positioning.
            // For a production app, consider a custom tooltip solution if this is flaky.
            // target={popoverTarget as HTMLElement}
            // Removed target prop as it's not standard and might cause issues.
            // Positioning will rely on the trigger (hidden button) or default Popover behavior.
            // Consider using event coordinates to position a custom tooltip if Popover isn't ideal.
          >
            <div className="space-y-2">
              <h4 className="font-semibold text-lg text-primary flex items-center">
                <MapPin className="mr-2 h-5 w-5" />
                {tooltipContent.name}
              </h4>
              {tooltipContent.population !== undefined && (
                <p className="text-sm text-muted-foreground flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  Population: {tooltipContent.population.toLocaleString()}
                </p>
              )}
              {/* Add more details from geo.properties or Firestore if needed */}
              <p className="text-xs text-muted-foreground/80">
                {(tooltipContent as ProvinceMapData).ADM0_EN && `Country: ${(tooltipContent as ProvinceMapData).ADM0_EN}`}
              </p>
              
              <Button asChild variant="outline" size="sm" className="w-full mt-2 border-accent text-accent hover:bg-accent/10">
                <Link href={tooltipContent.type === "City" ? `/cities/${tooltipContent.id}` : `/districts?name=${(tooltipContent as ProvinceMapData)?.ADM1_EN || tooltipContent.id}`}>
                  Learn More <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </PopoverContent>
        )}
      </Popover>
       <div className="absolute bottom-2 right-2 bg-background/80 p-2 rounded shadow text-xs text-muted-foreground">
        Map data &copy; <a href="https://gadm.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">GADM</a>. Click on a province or city.
      </div>
    </div>
  );
}
