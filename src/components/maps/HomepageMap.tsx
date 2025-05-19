
"use client";

import type { GeoJSON as LocalGeoJSON, ProvinceMapData, CityMapData as LocalCityMapData } from '@/types';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { InfoIcon, ExternalLink, XIcon, MapPin as InfoBoxMapPin, Users, Pin } from 'lucide-react';
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

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Ensure this file exists in public/data

interface ProvinceFeatureProperties {
  NAME_1?: string;
  ADM1_EN?: string;
  DIST_EN?: string; // Added for flexibility if ADM1_EN is not present
  OBJECTID?: string | number;
  [key: string]: any;
}

interface ExtendedProvinceMapData extends ProvinceMapData, ProvinceFeatureProperties {
  type: "Province";
}

interface ExtendedCityMapData extends LocalCityMapData {
  // Inherits from LocalCityMapData, no new fields needed here unless specific for this map
}

interface SelectedFeatureInfo {
  feature: ExtendedProvinceMapData | ExtendedCityMapData;
  pageX: number;
  pageY: number;
}

const majorCities: ExtendedCityMapData[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], type: "City", description: "Capital city, rich in culture.", link: "/districts?name=Kathmandu", highlight: true },
  { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], type: "City", description: "City of lakes and mountain views.", link: "/districts?name=Kaski", highlight: true },
  { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], type: "City", description: "Birthplace of Lord Buddha.", link: "/districts?name=Rupandehi", highlight: true },
];

export function HomepageMap() {
  const [selectedFeatureInfo, setSelectedFeatureInfo] = React.useState<SelectedFeatureInfo | null>(null);
  const [mapData, setMapData] = React.useState<any | null>(null);
  const [provinceDetails, setProvinceDetails] = React.useState<Record<string, Partial<ProvinceMapData>>>({});
  const [cityDetails, setCityDetails] = React.useState<Record<string, Partial<LocalCityMapData>>>({});
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
        if (!geoRes.ok) throw new Error(`Failed to fetch TopoJSON from ${NEPAL_GEO_URL}: ${geoRes.statusText}`);
        const topoJsonData: any = await geoRes.json();
        
        console.log("HomepageMap: TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(topoJsonData, null, 2).substring(0,1000));

        if (typeof topoJsonData !== 'object' || topoJsonData === null || !topoJsonData.objects || Object.keys(topoJsonData.objects).length === 0) {
          setFetchError(`Invalid TopoJSON structure in ${NEPAL_GEO_URL}: 'objects' property is missing or empty. Ensure it's a valid TopoJSON, not GeoJSON FeatureCollection. Received: ${JSON.stringify(topoJsonData, null, 2).substring(0,500)}`);
          setIsLoading(false);
          return;
        }
        
        const firstKey = Object.keys(topoJsonData.objects)[0];
        if (!firstKey || !topoJsonData.objects[firstKey] || !(topoJsonData.objects[firstKey].type === "GeometryCollection" && Array.isArray(topoJsonData.objects[firstKey].geometries))) {
             setFetchError(`Invalid TopoJSON: Layer "${firstKey}" in ${NEPAL_GEO_URL} is not a GeometryCollection or does not contain 'geometries'. Expected format: { "type": "Topology", "objects": { "your_layer_name": { "type": "GeometryCollection", "geometries": [...] } }, "arcs": [...] }.`);
             setIsLoading(false);
             return;
        }
        provinceObjectKeyRef.current = firstKey;
        setMapData(topoJsonData);

        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, Partial<ProvinceMapData>> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          const normalizedId = (data.id?.toLowerCase() || doc.id.toLowerCase()).replace(' province','').replace(/\s+/g, '_');
          provData[normalizedId] = { population: data.population, description: data.description, link: data.link };
        });
        setProvinceDetails(provData);
        console.log("HomepageMap: Fetched province details:", provData);

        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityDataColl: Record<string, Partial<LocalCityMapData>> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          cityDataColl[doc.id.toLowerCase()] = { population: data.population, description: data.description, link: data.link };
        });
        setCityDetails(cityDataColl);
        console.log("HomepageMap: Fetched city details:", cityDataColl);

      } catch (error) {
        console.error("Error loading map data:", error);
        const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while loading map data.";
        const specificError = errorMsg.includes("offline") || errorMsg.includes("Failed to get document") ? 
            `Map data could not be loaded. Please check your internet connection and Firebase setup/configuration. (${errorMsg})` 
            : `Error fetching or parsing map data: ${errorMsg}`;
        setFetchError(specificError);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleMapClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Close info box if clicking on the map container itself (background)
    if (event.target === event.currentTarget || (event.target as HTMLElement).closest('.composable-map-container') === event.currentTarget.querySelector('.composable-map-container')) {
        setSelectedFeatureInfo(null);
    }
  }, []);
  
  React.useEffect(() => {
    if (selectedFeatureInfo) {
        console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
    }
  }, [selectedFeatureInfo]);

  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/10 dark:bg-muted/20 rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
         <p className="absolute text-primary font-semibold">Loading Interactive Map of Nepal...</p>
      </div>
    );
  }
  
  if (fetchError || !mapData || !provinceObjectKeyRef.current || !mapData.objects[provinceObjectKeyRef.current]) {
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData, "provinceObjectKey valid:", !!provinceObjectKeyRef.current, "mapData.objects content:", mapData ? mapData.objects : 'N/A');
    return (
      <div className="aspect-[16/9] w-full bg-destructive/10 dark:bg-destructive/20 rounded-lg flex flex-col items-center justify-center text-destructive-foreground p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">
          {fetchError ? fetchError : "Could not load or parse map data. Ensure public/data/nepal-provinces-topo.json is correct and Firebase data is accessible."}
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef}
      className="relative aspect-[16/9] w-full bg-muted/50 dark:bg-muted/70 rounded-lg shadow-lg overflow-hidden border border-border" // Changed to theme color
      onClick={handleMapClick} 
    >
      {selectedFeatureInfo && selectedFeatureInfo.feature && (
         <Card 
          className="fixed p-0 w-64 shadow-xl border-border bg-background text-foreground z-[60] rounded-md transition-all duration-200 ease-out"
          style={{ 
            left: `${selectedFeatureInfo.pageX + 15}px`, 
            top: `${selectedFeatureInfo.pageY + 15}px`,
            transform: selectedFeatureInfo.pageX > (mapContainerRef.current ? mapContainerRef.current.offsetWidth - 300 : window.innerWidth - 300) ? 'translateX(calc(-100% - 30px))' : 'none',
          }}
          onClick={(e) => e.stopPropagation()} 
         >
          <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 bg-muted/50 rounded-t-md">
            <CardTitle className="text-sm font-semibold text-primary flex items-center gap-1.5">
              <InfoBoxMapPin className="h-4 w-4 flex-shrink-0 text-accent" />
              {selectedFeatureInfo.feature.name}
            </CardTitle>
             <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => setSelectedFeatureInfo(null)} aria-label="Close info box">
                <XIcon className="h-3.5 w-3.5" />
             </Button>
          </CardHeader>
          <CardContent className="p-3 pt-2 text-xs space-y-1">
            <p className="text-muted-foreground">Type: {selectedFeatureInfo.feature.type}</p>
            {selectedFeatureInfo.feature.population !== undefined && (
              <p className="text-muted-foreground flex items-center">
                <Users className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                Approx. Pop: {selectedFeatureInfo.feature.population.toLocaleString()}
              </p>
            )}
            {selectedFeatureInfo.feature.description && (
                <p className="text-muted-foreground line-clamp-3">{selectedFeatureInfo.feature.description}</p>
            )}
          </CardContent>
          {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 pt-1">
                <Button asChild variant="outline" size="xs" className="w-full text-accent border-accent hover:bg-accent/10 hover:text-accent">
                  <Link href={selectedFeatureInfo.feature.link} target="_blank" rel="noopener noreferrer">
                    Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Link>
                </Button>
            </CardFooter>
          )}
        </Card>
      )}
      <div className="composable-map-container h-full w-full">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 4500, 
            center: [84.1240, 28.3949] 
          }}
          style={{ width: "100%", height: "100%" }}
          aria-label="Interactive map of Nepal showing provinces and key cities"
        >
          <ZoomableGroup center={[84.1240, 28.3949]} zoom={1} minZoom={0.7} maxZoom={10}>
            {mapData && provinceObjectKeyRef.current && mapData.objects[provinceObjectKeyRef.current] && (
              <Geographies geography={mapData} object={mapData.objects[provinceObjectKeyRef.current]}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const properties = geo.properties as ProvinceFeatureProperties;
                    const provinceName = properties.ADM1_EN || properties.NAME_1 || properties.DIST_EN || `province_${properties.OBJECTID}`;
                    const geoId = provinceName.toLowerCase().replace(/\s+/g, '_').replace(' province','');
                    const details = provinceDetails[geoId] || {};
                    const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === "Province";

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={(event: React.MouseEvent<SVGPathElement>) => {
                          event.stopPropagation(); 
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
                          "stroke-border stroke-[0.5px] outline-none transition-all duration-150 ease-in-out cursor-pointer",
                          isSelected 
                              ? "fill-accent/70 stroke-accent-foreground/70 stroke-[1.5px]" 
                              : "fill-card dark:fill-card hover:fill-accent/40 dark:hover:fill-accent/50"
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
            {mapData && provinceObjectKeyRef.current && mapData.objects[provinceObjectKeyRef.current] && (
              <Geographies geography={mapData} object={mapData.objects[provinceObjectKeyRef.current]}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const properties = geo.properties as ProvinceFeatureProperties;
                    const provinceName = properties.ADM1_EN || properties.NAME_1 || "";
                    const centroid = (geo as any).centroid as [number, number] | undefined; 
                    
                    const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi", "Sudurpashchim", "Madhesh", "Karnali"]; 
                    if (!centroid || !provinceName || !showLabelFor.some(p => provinceName.includes(p))) return null;

                    return (
                      <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                        <text
                          textAnchor="middle"
                          y={properties.NAME_1 === "Bagmati" ? 2 : (properties.NAME_1 === "Madhesh" ? -1 : 0)} 
                          className="text-[5px] md:text-[7px] fill-foreground pointer-events-none select-none font-medium"
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
            {majorCities.map(city => {
              const details = cityDetails[city.id.toLowerCase()] || {};
              const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo.feature.type === "City";
              const isKathmandu = city.name === "Kathmandu";
              return (
                <Marker
                  key={city.id}
                  coordinates={city.coordinates}
                  onClick={(event: React.MouseEvent<SVGGElement>) => {
                      event.stopPropagation(); 
                      setSelectedFeatureInfo({
                          feature: {
                              ...city,
                              population: details.population,
                              description: details.description || city.description,
                              link: details.link || city.link,
                          },
                          pageX: event.pageX,
                          pageY: event.pageY,
                      });
                  }}
                >
                  <circle
                    r={isSelected ? 4.5 : 3.5} 
                    className={cn(
                      "transition-all duration-150 ease-in-out cursor-pointer",
                      isSelected ? "fill-accent stroke-accent-foreground stroke-[1.5px]" : "fill-primary stroke-primary-foreground stroke-1 hover:fill-accent/80"
                    )}
                  />
                  <text
                    textAnchor="middle"
                    y={-6} 
                    className={cn(
                      "fill-foreground pointer-events-none select-none font-semibold",
                      isKathmandu ? "text-[7px] md:text-[9px]" : "text-[5px] md:text-[6px]"
                    )}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinecap: "butt", strokeLinejoin: "miter" }}
                  >
                    {city.name}
                  </text>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>
       <div className="absolute bottom-2 right-2 bg-background/80 p-1.5 rounded shadow text-[0.6rem] text-muted-foreground">
        Map data &copy; <a href="https://gadm.org/" target="_blank" rel="noopener noreferrer" className="hover:underline text-accent">GADM</a> (simplified). City data indicative.
      </div>
    </div>
  );
}
