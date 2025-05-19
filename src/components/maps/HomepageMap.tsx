
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
import { cn } from "@/lib/utils";


const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";

interface ProvinceFeatureProperties {
  NAME_1?: string; // Province name from GADM data
  DIST_EN?: string; // District name if using district-level GeoJSON
  ADM1_EN?: string; // Alternative province name key
  OBJECTID?: string | number; // Fallback ID
  [key: string]: any;
}

interface ProvinceMapData extends ProvinceFeatureProperties {
  id: string;
  name: string;
  population?: number;
  type?: string; // To distinguish from CityMapData in tooltipContent
}

interface CityMapData {
  id: string;
  name: string;
  coordinates: [number, number];
  population?: number;
  provinceId?: string;
  type: "City"; // To distinguish from ProvinceMapData
}

const majorCities: CityMapData[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], provinceId: "bagmati", type: "City" },
  { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], provinceId: "gandaki", type: "City" },
  { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], provinceId: "lumbini", type: "City" },
];

export function HomepageMap() {
  const [tooltipContent, setTooltipContent] = React.useState<ProvinceMapData | CityMapData | null>(null);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [popoverTarget, setPopoverTarget] = React.useState<EventTarget | null>(null);
  const [mapData, setMapData] = React.useState<any | null>(null); // Changed type to any for TopoJSON object
  const [provincePopulations, setProvincePopulations] = React.useState<Record<string, number>>({});
  const [cityPopulations, setCityPopulations] = React.useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) throw new Error(`Failed to fetch GeoJSON: ${geoRes.statusText}`);
        const geoData: any = await geoRes.json(); // geoData is the full TopoJSON object
        setMapData(geoData); // Store the full TopoJSON object

        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provPopData: Record<string, number> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          provPopData[data.name.toLowerCase().replace(' province','').replace(/\s+/g, '_')] = data.population;
        });
        setProvincePopulations(provPopData);

        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityPopData: Record<string, number> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          cityPopData[doc.id] = doc.data().population;
        });
        setCityPopulations(cityPopData);

      } catch (error) {
        console.error("Error loading map data:", error);
        // Set a generic error for tooltip if needed, or handle UI error state
        // setTooltipContent({ id: 'error', name: 'Error loading map data', population: 0 });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGeographyClick = (geo: GeographyProps, event: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    const properties = geo.properties as ProvinceFeatureProperties;
    const provinceId = properties.ADM1_EN?.toLowerCase().replace(/\s+/g, '_') || properties.DIST_EN?.toLowerCase().replace(/\s+/g, '_') || `province_${properties.OBJECTID}`;
    const provinceName = properties.ADM1_EN || properties.DIST_EN || "Unknown Province";

    setTooltipContent({
      id: provinceId,
      name: provinceName,
      population: provincePopulations[provinceId] || undefined,
      type: "Province", // Differentiate from City
      ...properties
    });
    setPopoverTarget(event.currentTarget);
    setPopoverOpen(true);
  };

  const handleMarkerClick = (city: CityMapData, event: React.MouseEvent<SVGGElement, MouseEvent>) => {
    setTooltipContent({
      ...city, // City already has type: "City"
      population: cityPopulations[city.id] || undefined,
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
          <button ref={(node) => { if (node && popoverTarget === node.firstChild) setPopoverTarget(node.firstChild); }} style={{ display: 'none' }} aria-hidden="true" />
        </PopoverTrigger>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 4500, 
            center: [84.1240, 28.3949] 
          }}
          style={{ width: "100%", height: "100%" }}
          aria-label="Interactive map of Nepal"
        >
          <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
            {/* Ensure mapData is not null/undefined before passing to Geographies */}
            {mapData && (
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
            )}
            {majorCities.map(city => (
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                onClick={(event) => handleMarkerClick(city, event)}
              >
                <circle r={5} className="fill-primary stroke-primary-foreground stroke-2 cursor-pointer hover:fill-accent transition-colors" />
                <title>{city.name}</title> 
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
        {tooltipContent && popoverOpen && ( // Ensure popoverOpen is also true
          <PopoverContent
            target={popoverTarget as HTMLElement | undefined} // Added as HTMLElement | undefined
            className="w-64 shadow-xl border-primary/30 bg-background p-4 rounded-lg"
            side="right"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()} 
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
              {(tooltipContent as ProvinceMapData).ADM0_EN && (
                <p className="text-xs text-muted-foreground/80">
                  Country: {(tooltipContent as ProvinceMapData).ADM0_EN}
                </p>
              )}
              
              <Button asChild variant="outline" size="sm" className="w-full mt-2 border-accent text-accent hover:bg-accent/10">
                <Link href={tooltipContent.type === "City" ? `/cities/${tooltipContent.id}` : `/districts?name=${(tooltipContent as ProvinceMapData)?.ADM1_EN || (tooltipContent as ProvinceMapData)?.DIST_EN || tooltipContent.id}`}>
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

