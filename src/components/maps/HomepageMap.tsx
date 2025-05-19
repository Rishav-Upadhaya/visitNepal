
"use client";

import type { GeoJSON } from '@/types';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
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

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Ensure this TopoJSON file exists and is simplified for performance.

interface ProvinceFeatureProperties {
  NAME_1?: string; // Province name from GADM data
  DIST_EN?: string; // District name if using district-level GeoJSON
  ADM1_EN?: string; // Alternative province name key
  OBJECTID?: string | number; // Fallback ID
  [key: string]: any;
}

interface BaseMapFeature {
  id: string;
  name: string;
  population?: number;
  type: "Province" | "City";
}

interface ProvinceMapData extends BaseMapFeature, ProvinceFeatureProperties {
  type: "Province";
  centroid?: [number, number];
}

interface CityMapData extends BaseMapFeature {
  type: "City";
  coordinates: [number, number];
  provinceId?: string; // Optional: to link city to a province if needed
}

const majorCities: CityMapData[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], provinceId: "bagmati", type: "City" },
  { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], provinceId: "gandaki", type: "City" },
  { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], provinceId: "lumbini", type: "City" },
];

export function HomepageMap() {
  const [hoveredFeature, setHoveredFeature] = React.useState<ProvinceMapData | CityMapData | null>(null);
  const [mapData, setMapData] = React.useState<any | null>(null); // Stores the entire TopoJSON object
  const [provincePopulations, setProvincePopulations] = React.useState<Record<string, number>>({});
  const [cityPopulations, setCityPopulations] = React.useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) throw new Error(`Failed to fetch TopoJSON: ${geoRes.statusText}`);
        const geoData: any = await geoRes.json();
        setMapData(geoData); // Store the full TopoJSON object

        // Fetch province populations
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provPopData: Record<string, number> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          // Normalize ID: lowercase, replace " Province", replace spaces with underscores
          const normalizedId = data.name?.toLowerCase().replace(' province','').replace(/\s+/g, '_') || doc.id;
          provPopData[normalizedId] = data.population;
        });
        setProvincePopulations(provPopData);

        // Fetch city populations
        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityPopData: Record<string, number> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          cityPopData[doc.id] = doc.data().population; // Assuming doc.id is 'kathmandu', 'pokhara' etc.
        });
        setCityPopulations(cityPopData);

      } catch (error) {
        console.error("Error loading map data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleMouseEnterGeography = (geo: GeographyProps) => {
    const properties = geo.properties as ProvinceFeatureProperties;
    const provinceId = properties.ADM1_EN?.toLowerCase().replace(/\s+/g, '_').replace(' province','') || properties.DIST_EN?.toLowerCase().replace(/\s+/g, '_') || `province_${properties.OBJECTID}`;
    const provinceName = properties.ADM1_EN || properties.DIST_EN || "Unknown Province";
    setHoveredFeature({
      id: provinceId,
      name: provinceName,
      population: provincePopulations[provinceId] || undefined,
      type: "Province",
      centroid: geo.centroid as [number, number],
      ...properties
    });
  };

  const handleMouseEnterMarker = (city: CityMapData) => {
    setHoveredFeature({
      ...city,
      population: cityPopulations[city.id] || undefined,
    });
  };

  const handleMouseLeaveMap = () => {
    setHoveredFeature(null);
  };

  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }
  
  if (!mapData) {
    return <div className="text-center py-10 text-destructive">Failed to load map data. Ensure <code>public/data/nepal-provinces-topo.json</code> exists and Firestore data is available.</div>;
  }

  return (
    <div 
      className="relative aspect-[16/9] w-full bg-muted/30 rounded-lg shadow-lg overflow-hidden border border-primary/20"
      onMouseLeave={handleMouseLeaveMap} // Clear info when mouse leaves the entire map area
    >
      {hoveredFeature && (
        <div className="absolute top-4 left-4 z-10 bg-background p-4 rounded-lg shadow-xl border border-primary/30 w-64">
          <h4 className="font-semibold text-lg text-primary flex items-center mb-1">
            <MapPin className="mr-2 h-5 w-5 flex-shrink-0" />
            {hoveredFeature.name}
          </h4>
          {hoveredFeature.population !== undefined && (
            <p className="text-sm text-muted-foreground flex items-center mb-2">
              <Users className="mr-2 h-4 w-4 flex-shrink-0" />
              Approx. Pop: {hoveredFeature.population.toLocaleString()}
            </p>
          )}
           <Button asChild variant="outline" size="sm" className="w-full mt-2 border-accent text-accent hover:bg-accent/10 hover:text-accent-foreground">
            <Link href={`/districts?name=${hoveredFeature.name}`}>
              Learn More <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

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
          {mapData && ( // Ensure mapData is loaded
            <Geographies geography={mapData}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const properties = geo.properties as ProvinceFeatureProperties;
                  const provinceIdFromGeo = properties.ADM1_EN?.toLowerCase().replace(/\s+/g, '_').replace(' province','') || properties.DIST_EN?.toLowerCase().replace(/\s+/g, '_') || `province_${properties.OBJECTID}`;
                  const isHovered = hoveredFeature?.id === provinceIdFromGeo && hoveredFeature?.type === "Province";

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => handleMouseEnterGeography(geo as GeographyProps)}
                      className={cn(
                        "fill-muted-foreground/30 stroke-background outline-none transition-all duration-150 ease-in-out cursor-pointer",
                        isHovered ? "fill-accent/80 stroke-accent-foreground" : "hover:fill-accent/50"
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
          {mapData && (
            <Geographies geography={mapData}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const properties = geo.properties as ProvinceFeatureProperties;
                  const provinceName = properties.ADM1_EN || properties.DIST_EN || "";
                  const centroid = geo.centroid as [number, number] | undefined;
                  if (!centroid || !provinceName) return null;

                  return (
                    <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        y={properties.NAME_1 === "Bagmati" ? 2 : 0} // Example: slightly adjust Bagmati label
                        className="text-[6px] fill-foreground pointer-events-none select-none" // Added select-none
                        style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinecap: "butt", strokeLinejoin: "miter" }}
                      >
                        {provinceName}
                      </text>
                    </Marker>
                  );
                })
              }
            </Geographies>
          )}
          {majorCities.map(city => {
            const isHovered = hoveredFeature?.id === city.id && hoveredFeature?.type === "City";
            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                onMouseEnter={() => handleMouseEnterMarker(city)}
              >
                <circle 
                  r={5} 
                  className={cn(
                    "stroke-background stroke-2 cursor-pointer transition-colors",
                    isHovered ? "fill-primary" : "fill-primary/70 hover:fill-primary"
                  )}
                />
                <title>{city.name}</title> 
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
       <div className="absolute bottom-2 right-2 bg-background/80 p-2 rounded shadow text-xs text-muted-foreground">
        Map data &copy; <a href="https://gadm.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">GADM</a>. Hover to explore.
      </div>
    </div>
  );
}
