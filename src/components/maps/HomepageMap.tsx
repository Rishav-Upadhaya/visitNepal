
"use client";

import type { GeoJSON } from '@/types';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { MapPin, Users, InfoIcon, ExternalLink, XIcon } from 'lucide-react';
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

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Ensure this TopoJSON is simplified

interface BaseMapFeature {
  id: string;
  name: string;
  population?: number;
  type: "Province" | "City";
  description?: string;
  link?: string;
}
interface ProvinceFeatureProperties {
  NAME_1?: string;
  ADM1_EN?: string;
  OBJECTID?: string | number;
  [key: string]: any;
}

interface ProvinceMapData extends BaseMapFeature, ProvinceFeatureProperties {
  type: "Province";
}

interface CityMapData extends BaseMapFeature {
  type: "City";
  coordinates: [number, number];
}

interface SelectedFeatureInfo {
  feature: ProvinceMapData | CityMapData;
  pageX: number;
  pageY: number;
}

const majorCities: CityMapData[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], type: "City", description: "Capital city, rich in culture.", link: "/districts?name=Kathmandu" },
  { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], type: "City", description: "City of lakes and mountain views.", link: "/districts?name=Kaski" },
  { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], type: "City", description: "Birthplace of Lord Buddha.", link: "/districts?name=Rupandehi" },
];

export function HomepageMap() {
  const [selectedFeatureInfo, setSelectedFeatureInfo] = React.useState<SelectedFeatureInfo | null>(null);
  const [mapData, setMapData] = React.useState<any | null>(null);
  const [provinceDetails, setProvinceDetails] = React.useState<Record<string, Partial<ProvinceMapData>>>({});
  const [cityDetails, setCityDetails] = React.useState<Record<string, Partial<CityMapData>>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const provinceObjectKeyRef = React.useRef<string | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);


  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) throw new Error(`Failed to fetch TopoJSON: ${geoRes.statusText}`);
        const topoJsonData: any = await geoRes.json();
        
        console.log("HomepageMap: TopoJSON fetched. Parsed data sample:", JSON.stringify(topoJsonData, null, 2).substring(0, 500));


        if (typeof topoJsonData !== 'object' || topoJsonData === null || !topoJsonData.objects || Object.keys(topoJsonData.objects).length === 0) {
          setFetchError("Invalid TopoJSON structure: 'objects' property is missing or empty. Check public/data/nepal-provinces-topo.json");
          setIsLoading(false);
          return;
        }
        
        const firstKey = Object.keys(topoJsonData.objects)[0];
        if (!firstKey || !topoJsonData.objects[firstKey] || !topoJsonData.objects[firstKey].geometries) {
             setFetchError(`Invalid TopoJSON: Layer "${firstKey}" does not contain 'geometries'. Check file structure.`);
             setIsLoading(false);
             return;
        }
        provinceObjectKeyRef.current = firstKey;
        setMapData(topoJsonData);

        // Fetch province populations/details
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, Partial<ProvinceMapData>> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          const normalizedId = data.id?.toLowerCase().replace(' province','').replace(/\s+/g, '_') || doc.id.toLowerCase().replace(' province','').replace(/\s+/g, '_');
          provData[normalizedId] = { population: data.population, description: data.description, link: data.link };
        });
        setProvinceDetails(provData);

        // Fetch city populations/details
        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityDataColl: Record<string, Partial<CityMapData>> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          cityDataColl[doc.id.toLowerCase()] = { population: data.population, description: data.description, link: data.link };
        });
        setCityDetails(cityDataColl);

      } catch (error) {
        console.error("Error loading map data:", error);
        const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while loading map data.";
        setFetchError(errorMsg.includes("offline") || errorMsg.includes("Failed to get document") ? 
            `Map data could not be loaded. Please check your internet connection and Firebase setup. (${errorMsg})` 
            : errorMsg
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleMapClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Close info box if click is directly on map container and not on a feature
    if (event.target === event.currentTarget) {
        setSelectedFeatureInfo(null);
    }
  }, []);
  
  React.useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/30 rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
         <p className="absolute text-primary font-semibold">Loading Interactive Map of Nepal...</p>
      </div>
    );
  }
  
  if (fetchError || !mapData || !provinceObjectKeyRef.current || !mapData.objects[provinceObjectKeyRef.current]) {
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData, "provinceObjectKey valid:", !!provinceObjectKeyRef.current);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">{fetchError || "Could not load or parse map data. Please ensure public/data/nepal-provinces-topo.json is correct and Firebase data is accessible."}</p>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef}
      className="relative aspect-[16/9] w-full bg-green-100 dark:bg-green-900/20 rounded-lg shadow-lg overflow-hidden border border-primary/10"
      onClick={handleMapClick} // Handle clicks on the map container to close info box
    >
      {selectedFeatureInfo && selectedFeatureInfo.feature && (
         <Card 
          className="fixed p-0 w-64 shadow-xl border-border bg-background text-foreground z-[1001] rounded-md transition-all duration-200 ease-out"
          style={{ 
            left: `${selectedFeatureInfo.pageX + 15}px`, 
            top: `${selectedFeatureInfo.pageY + 15}px`,
            transform: selectedFeatureInfo.pageX > window.innerWidth - 300 ? 'translateX(-100%) translateY(-15px)' : 'translateY(-15px)', // Adjust if too close to edge
          }}
          onClick={(e) => e.stopPropagation()} // Prevent map click when clicking inside info box
         >
          <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-primary flex items-center">
              <MapPin className="mr-1.5 h-4 w-4 flex-shrink-0 text-accent" />
              {selectedFeatureInfo.feature.name}
            </CardTitle>
             <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => setSelectedFeatureInfo(null)} aria-label="Close info box">
                <XIcon className="h-3.5 w-3.5" />
             </Button>
          </CardHeader>
          <CardContent className="p-3 pt-0 text-xs space-y-1">
            <p className="text-muted-foreground">Type: {selectedFeatureInfo.feature.type}</p>
            {selectedFeatureInfo.feature.population !== undefined && (
              <p className="text-muted-foreground flex items-center">
                <Users className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                Approx. Pop: {selectedFeatureInfo.feature.population.toLocaleString()}
              </p>
            )}
            {selectedFeatureInfo.feature.description && (
                <p className="text-muted-foreground line-clamp-2">{selectedFeatureInfo.feature.description}</p>
            )}
          </CardContent>
          {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 pt-0">
                <Button asChild variant="outline" size="xs" className="w-full text-accent border-accent hover:bg-accent/10 hover:text-accent">
                  <Link href={selectedFeatureInfo.feature.link}>
                    Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
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
                  const geoId = provinceName.toLowerCase().replace(/\s+/g, '_').replace(' province','');
                  const details = provinceDetails[geoId] || {};

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={(event: React.MouseEvent<SVGPathElement>) => {
                        event.stopPropagation(); // Prevent map click handler
                        setSelectedFeatureInfo({
                          feature: {
                            id: geoId,
                            name: provinceName,
                            type: "Province",
                            population: details.population,
                            description: details.description,
                            link: details.link || `/districts?name=${encodeURIComponent(provinceName)}`,
                            ...properties
                          },
                          pageX: event.pageX,
                          pageY: event.pageY,
                        });
                      }}
                      className={cn(
                        "stroke-gray-400 dark:stroke-gray-600 stroke-[0.5px] outline-none transition-all duration-150 ease-in-out cursor-pointer",
                        selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === "Province" 
                            ? "fill-accent/50 stroke-accent-foreground stroke-[1.5px]" 
                            : "fill-gray-100 dark:fill-gray-800 hover:fill-accent/30 dark:hover:fill-accent/40"
                      )}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none' },
                        pressed: { outline: 'none' },
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
                  
                  const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi"]; 
                  if (!centroid || !provinceName || !showLabelFor.some(p => provinceName.includes(p))) return null;

                  return (
                    <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        y={properties.NAME_1 === "Bagmati" ? 2 : 0} // Slight adjustment for Bagmati if needed
                        className="text-[5px] md:text-[6px] fill-foreground/70 dark:fill-foreground/50 pointer-events-none select-none font-medium"
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
            const details = cityDetails[city.id.toLowerCase()] || {};
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo.feature.type === "City";
            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                 onClick={(event: React.MouseEvent<SVGGElement>) => {
                    event.stopPropagation(); // Prevent map click handler
                    setSelectedFeatureInfo({
                        feature: {
                            ...city,
                            population: details.population,
                            description: details.description,
                            link: details.link || city.link,
                        },
                        pageX: event.pageX,
                        pageY: event.pageY,
                    });
                }}
              >
                <g
                  className={cn(
                    "transition-all duration-150 ease-in-out transform cursor-pointer",
                    isSelected ? "text-accent scale-125" : "text-primary animate-pulse hover:text-accent hover:scale-110"
                  )}
                >
                  <MapPin className="w-3 h-3 md:w-4 md:h-4" strokeWidth={isSelected ? 2.5 : 2}/>
                </g>
                {/* <title>{city.name}</title>  Using info box instead */}
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
       <div className="absolute bottom-2 right-2 bg-background/80 p-1.5 rounded shadow text-xs text-muted-foreground">
        Map data &copy; <a href="https://gadm.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">GADM</a>. Simplified.
      </div>
    </div>
  );
}
