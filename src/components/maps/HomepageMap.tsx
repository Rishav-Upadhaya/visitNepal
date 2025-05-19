
"use client";

import type { GeoJSON } from '@/types';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Import Card components
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

interface BaseMapFeature {
  id: string;
  name: string;
  population?: number;
  type: "Province" | "City";
  link?: string; // For "Learn More" button
}

interface ProvinceMapData extends BaseMapFeature, ProvinceFeatureProperties {
  type: "Province";
  centroid?: [number, number];
}

interface CityMapData extends BaseMapFeature {
  type: "City";
  coordinates: [number, number];
  provinceId?: string;
}

const majorCities: CityMapData[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], provinceId: "bagmati", type: "City", link: "/districts?name=Kathmandu" },
  { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], provinceId: "gandaki", type: "City", link: "/districts?name=Kaski" }, // Assuming Pokhara is in Kaski district
  { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], provinceId: "lumbini", type: "City", link: "/districts?name=Rupandehi" }, // Assuming Lumbini is in Rupandehi district
];

export function HomepageMap() {
  const [hoveredFeature, setHoveredFeature] = React.useState<ProvinceMapData | CityMapData | null>(null);
  const [mapData, setMapData] = React.useState<any | null>(null);
  const [provincePopulations, setProvincePopulations] = React.useState<Record<string, number>>({});
  const [cityPopulations, setCityPopulations] = React.useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const provinceObjectKeyRef = React.useRef<string | null>(null);


  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) throw new Error(`Failed to fetch TopoJSON: ${geoRes.statusText}`);
        const topoJsonData: any = await geoRes.json();
        console.log("HomepageMap: TopoJSON fetched successfully. Parsed data:", JSON.stringify(topoJsonData, null, 2));


        if (typeof topoJsonData !== 'object' || topoJsonData === null || !topoJsonData.objects || Object.keys(topoJsonData.objects).length === 0) {
          throw new Error("Invalid TopoJSON structure: 'objects' property is missing or empty.");
        }
        
        // Dynamically get the first key from the objects property
        const firstObjectKey = Object.keys(topoJsonData.objects)[0];
        if (!firstObjectKey || !topoJsonData.objects[firstObjectKey] || !topoJsonData.objects[firstObjectKey].geometries) {
             throw new Error(`Invalid TopoJSON: Layer "${firstObjectKey}" does not contain 'geometries'. Check your TopoJSON file structure.`);
        }
        provinceObjectKeyRef.current = firstObjectKey;
        setMapData(topoJsonData);

        // Fetch province populations
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provPopData: Record<string, number> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          const normalizedId = data.name?.toLowerCase().replace(' province','').replace(/\s+/g, '_') || doc.id;
          provPopData[normalizedId] = data.population;
        });
        setProvincePopulations(provPopData);

        // Fetch city populations
        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityPopData: Record<string, number> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          const cityData = doc.data();
          cityPopData[doc.id.toLowerCase()] = cityData.population;
        });
        setCityPopulations(cityPopData);

      } catch (error) {
        console.error("Error loading map data:", error);
        setFetchError(error instanceof Error ? error.message : "An unknown error occurred while loading map data.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleMouseEnterGeography = (geo: GeographyProps) => {
    const properties = geo.properties as ProvinceFeatureProperties;
    // Prioritize ADM1_EN, then NAME_1, then a fallback for ID
    const provinceName = properties.ADM1_EN || properties.NAME_1 || "Unknown Province";
    const provinceId = provinceName.toLowerCase().replace(/\s+/g, '_').replace(' province','');
    
    setHoveredFeature({
      id: provinceId,
      name: provinceName,
      population: provincePopulations[provinceId] || undefined,
      type: "Province",
      centroid: geo.centroid as [number, number],
      link: `/districts?name=${encodeURIComponent(provinceName)}`, // Assuming province name is used for district link
      ...properties
    });
  };

  const handleMouseEnterMarker = (city: CityMapData) => {
    setHoveredFeature({
      ...city,
      population: cityPopulations[city.id.toLowerCase()] || undefined,
    });
  };

  const handleMouseLeaveMap = () => {
    setHoveredFeature(null);
  };

  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
         <p className="absolute text-primary font-semibold">Loading Map Data...</p>
      </div>
    );
  }
  
  if (fetchError || !mapData || !provinceObjectKeyRef.current || !mapData.objects[provinceObjectKeyRef.current]) {
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData, "provinceObjectKey valid:", !!provinceObjectKeyRef.current);
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 rounded-lg flex flex-col items-center justify-center text-destructive/80 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1">Map Data Error</p>
        <p className="text-xs">{fetchError || "Could not load or parse map data. Please check the TopoJSON file and console."}</p>
      </div>
    );
  }


  return (
    <div 
      className="relative aspect-[16/9] w-full bg-muted/30 rounded-lg shadow-lg overflow-hidden border border-primary/20"
      onMouseLeave={handleMouseLeaveMap}
    >
      {hoveredFeature && (
         <Card className="absolute top-4 left-4 z-10 w-64 shadow-xl border-border bg-background">
          <CardHeader className="p-3">
            <CardTitle className="text-md text-primary flex items-center">
              <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-accent" />
              {hoveredFeature.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 text-xs">
            {hoveredFeature.population !== undefined && (
              <p className="text-muted-foreground flex items-center mb-1">
                <Users className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                Approx. Pop: {hoveredFeature.population.toLocaleString()}
              </p>
            )}
            <p className="text-muted-foreground">Type: {hoveredFeature.type}</p>
          </CardContent>
          {hoveredFeature.link && (
            <CardFooter className="p-3 pt-0">
                <Button asChild variant="outline" size="sm" className="w-full text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground">
                  <Link href={hoveredFeature.link}>
                    Learn More <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
            </CardFooter>
          )}
        </Card>
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
          {mapData && provinceObjectKeyRef.current && mapData.objects[provinceObjectKeyRef.current] && (
            <Geographies geography={mapData} object={mapData.objects[provinceObjectKeyRef.current]}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const properties = geo.properties as ProvinceFeatureProperties;
                  const provinceName = properties.ADM1_EN || properties.NAME_1 || `province_${properties.OBJECTID}`;
                  const provinceId = provinceName.toLowerCase().replace(/\s+/g, '_').replace(' province','');
                  const isHovered = hoveredFeature?.id === provinceId && hoveredFeature?.type === "Province";

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => handleMouseEnterGeography(geo as GeographyProps)}
                      className={cn(
                        "stroke-primary/50 stroke-[0.5px] outline-none transition-all duration-150 ease-in-out cursor-pointer",
                        isHovered ? "fill-accent/60 stroke-accent-foreground stroke-[1px]" : "fill-primary/20 hover:fill-accent/40"
                      )}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none' }, // className handles hover fill
                        pressed: { outline: 'none', fill: "hsl(var(--accent))", stroke: "hsl(var(--accent-foreground))" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          )}
           {/* Province Labels */}
          {mapData && provinceObjectKeyRef.current && mapData.objects[provinceObjectKeyRef.current] && (
             <Geographies geography={mapData} object={mapData.objects[provinceObjectKeyRef.current]}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const properties = geo.properties as ProvinceFeatureProperties;
                  const provinceName = properties.ADM1_EN || properties.NAME_1 || "";
                  const centroid = (geo as any).centroid as [number, number] | undefined;
                  
                  // Basic filter to avoid too much clutter, adjust as needed
                  const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi"]; // Example
                  if (!centroid || !provinceName || !showLabelFor.some(p => provinceName.includes(p))) return null;


                  return (
                    <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        y={properties.NAME_1 === "Bagmati" ? 2 : 0} 
                        className="text-[5px] md:text-[6px] fill-foreground pointer-events-none select-none font-medium"
                        style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.75px", strokeLinecap: "butt", strokeLinejoin: "miter" }}
                      >
                        {provinceName.replace(" Province", "")}
                      </text>
                    </Marker>
                  );
                })
              }
            </Geographies>
          )}
          {/* Key City Markers */}
          {majorCities.map(city => {
            const isHovered = hoveredFeature?.id === city.id && hoveredFeature?.type === "City";
            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                onMouseEnter={() => handleMouseEnterMarker(city)}
              >
                <g
                  className={cn(
                    "transition-all duration-150 ease-in-out transform",
                    isHovered ? "text-accent scale-125" : "text-primary animate-pulse"
                  )}
                >
                  <MapPin className="w-3 h-3 md:w-4 md:h-4" strokeWidth={isHovered ? 2.5 : 2}/>
                </g>
                <title>{city.name}</title> 
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
       <div className="absolute bottom-2 right-2 bg-background/80 p-2 rounded shadow text-xs text-muted-foreground">
        Map data &copy; <a href="https://gadm.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">GADM</a>. Simplified for display.
      </div>
    </div>
  );
}

    