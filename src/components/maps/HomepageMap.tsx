
// src/components/maps/HomepageMap.tsx
"use client";

import type { ProvinceMapData, CityMapData, ExtendedFeature } from '@/types';
import { useEffect, useState, useRef, useCallback }  from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology, type Objects } from 'topojson-client';

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // This must match the object key in your TopoJSON file

// Combine Province and City data types for the selected feature
type SelectedFeatureDataType = Partial<ProvinceMapData & CityMapData> & {
    name: string;
    id: string;
    type: 'Province' | 'City';
    description?: string;
    link?: string;
    population?: number;
    properties?: any;
};

interface SelectedFeatureDisplayInfo {
  feature: SelectedFeatureDataType;
  pageX: number;
  pageY: number;
}

const majorCities: Array<CityMapData> = [
  { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', highlight: true, description: "The vibrant capital city, rich in culture and ancient temples.", population: 1442271, link: '/districts?name=Kathmandu' },
  { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', highlight: true, description: "A picturesque city known for Phewa Lake and stunning Himalayan views.", population: 400000, link: '/districts?name=Kaski' },
  { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', highlight: true, description: "The sacred birthplace of Lord Buddha, a UNESCO World Heritage site.", population: 70000, link: '/districts?name=Rupandehi' },
];

export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false); // To indicate loading of province/city details
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setSelectedFeatureInfo(null); // Clear selection on new data load

      try {
        console.log(`HomepageMap: Fetching map geometry from ${NEPAL_GEO_URL}...`);
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
        const rawMapData: Topology = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");

        if (rawMapData && typeof rawMapData === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          if (layer && (layer.type === 'GeometryCollection' || (layer as any).geometries)) {
            // Convert TopoJSON to GeoJSON features
            const geoJsonFeatures = topojsonFeature(rawMapData, layer as Objects<any>).features as ExtendedFeature[];
            setMapData(geoJsonFeatures);
            console.log(`HomepageMap: TopoJSON processed into ${geoJsonFeatures.length} GeoJSON features.`);
          } else {
            const errorMsg = `Invalid TopoJSON structure: Layer key "${TOPOJSON_OBJECT_KEY}" does not contain a 'geometries' array or is not a GeometryCollection. Layer content: ${JSON.stringify(layer).substring(0,200)}...`;
            console.error("HomepageMap:", errorMsg);
            setFetchError(errorMsg);
            setMapData(null);
          }
        } else {
          const errorMsg = `Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
        }
      } catch (err) {
        console.error("HomepageMap: Error fetching or processing map geometry:", err);
        const specificError = err instanceof Error ? err.message : "An unknown error occurred while fetching map geometry.";
        
        if (specificError.includes("offline") || specificError.includes("Failed to get document")) {
            setFetchError(`Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${specificError}`);
        } else if (specificError.includes("Invalid TopoJSON structure") || specificError.includes("404 Not Found") || specificError.includes("404")) {
            setFetchError(`Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}'). Original: ${specificError}`);
        } else {
            setFetchError(specificError);
        }
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };

    fetchData();
  }, []);

  const handleMapClick = useCallback(() => {
    setSelectedFeatureInfo(null); // Close info box if map background is clicked
  }, []);

  const closeInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);

  useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo state updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  let displayErrorMessage = fetchError;
  if (fetchError) {
    if (fetchError.includes("offline") || fetchError.includes("Failed to get document")) {
        displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
    } else if (fetchError.includes("Invalid TopoJSON structure") || fetchError.includes("Invalid GeoJSON data structure") || fetchError.includes("404")) {
         displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid (TopoJSON or GeoJSON FeatureCollection), and contains the expected layer ('${TOPOJSON_OBJECT_KEY}' if TopoJSON). Original: ${fetchError}`;
    }
  }

  if (isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 dark:bg-muted/30 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map of Nepal...</p>
      </div>
    );
  }
  
  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable. Please check the console."}</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full aspect-[16/9] bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={handleMapClick} 
    >
       <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 2800, 
          center: [84.1240, 28.3949] 
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing provinces and major cities"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
          <Geographies 
            geography={mapData}
          >
            {({ geographies }) =>
              geographies.map((geo: ExtendedFeature) => {
                const currentProperties = (geo.properties || {}) as ProvinceMapData['properties'] & { name?: string; DIST_EN?: string; ADM1_EN?: string; id?: string; description?: string; link?: string; population?: number};
                const provinceName = currentProperties?.name || currentProperties?.DIST_EN || currentProperties?.ADM1_EN || "Unknown Province";
                const geoId = String(geo.id || currentProperties?.id || geo.rsmKey || provinceName + Math.random());
                
                const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === 'Province';

                const featureDataForInfoBox: SelectedFeatureDataType = {
                  id: geoId,
                  name: provinceName,
                  type: 'Province',
                  description: currentProperties?.description || `Explore ${provinceName}, a diverse province in Nepal.`,
                  link: currentProperties?.link || `/districts?name=${encodeURIComponent(provinceName)}`,
                  population: currentProperties?.population,
                  properties: geo.properties || {}
                };

                return (
                  <Geography
                    key={geoId}
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => {
                       event.stopPropagation(); 
                       console.log("Geography Clicked:", provinceName, "Event clientX:", event.clientX, "clientY:", event.clientY, "Feature Data:", featureDataForInfoBox);
                       setSelectedFeatureInfo({
                         feature: featureDataForInfoBox,
                         pageX: event.clientX, 
                         pageY: event.clientY,
                       });
                    }}
                    className={
                      `transition-all duration-150 ease-out outline-none
                       ${isSelected 
                            ? 'fill-accent/70 dark:fill-accent/60 stroke-accent-foreground dark:stroke-accent-foreground/80 stroke-[1.5px]' 
                            : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-500 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer'
                       }`
                    }
                    aria-label={provinceName}
                  />
                );
              })
            }
          </Geographies>

           <Geographies
            geography={mapData}
          >
            {({ geographies }) =>
                geographies.map(geo => {
                    const properties = (geo.properties || {}) as ProvinceMapData['properties'] & { name?: string; DIST_EN?: string; ADM1_EN?: string; };
                    const provinceName = properties?.name || properties?.DIST_EN || properties?.ADM1_EN || "";
                    const centroid = (geo as any).centroid as [number, number] | undefined; 

                    if (!centroid || !provinceName) return null;

                    let fontSize = 5;
                    let yOffset = 0;
                    if (["Bagmati", "Lumbini Province", "Gandaki Province", "Koshi Province"].some(p => provinceName.includes(p))) {
                        fontSize = provinceName.includes("Bagmati") || provinceName.includes("Lumbini Province") ? 6 : 5.5;
                    }
                    if (provinceName.length > 15) fontSize = Math.max(3.5, fontSize - 1.5);
                    if (provinceName.length > 20) fontSize = Math.max(3, fontSize - 1);


                    return (
                        <Marker key={`label-${geo.id || geo.rsmKey}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={yOffset}
                                fontSize={fontSize}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground dark:fill-background pointer-events-none select-none"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                            >
                                {provinceName.replace(" Province", "").replace(" Pradesh", "")}
                            </text>
                        </Marker>
                    );
                })
            }
          </Geographies>

          {majorCities.map((city) => {
            const cityToDisplay: SelectedFeatureDataType = {
              ...city,
              description: city.description || `Discover ${city.name}, a major hub in Nepal.`,
              link: city.link || `/districts?name=${encodeURIComponent(city.name)}`, 
            };
            const isSelected = selectedFeatureInfo?.feature.id === cityToDisplay.id && selectedFeatureInfo.feature.type === 'City';
            
            let labelFontSize = (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") ? 7 : 5;
            let yTextOffset = (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") ? -9 : -8;


            return (
              <Marker
                key={cityToDisplay.id}
                coordinates={cityToDisplay.coordinates!}
                onClick={(event: any) => { 
                  event.stopPropagation();
                   console.log("City marker clicked:", cityToDisplay.name, "Event clientX:", event.clientX, "clientY:", event.clientY, "Feature Data:", cityToDisplay);
                  setSelectedFeatureInfo({
                    feature: cityToDisplay,
                    pageX: event.clientX, 
                    pageY: event.clientY,
                  });
                }}
              >
                 <g className="cursor-pointer transition-all duration-150 group">
                  <circle
                    r={isSelected ? 6 : 4}
                    className={isSelected 
                        ? 'fill-accent stroke-accent-foreground dark:fill-accent dark:stroke-accent-foreground'
                        : 'fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground'}
                    strokeWidth={0.75}
                  />
                </g>
                <text
                  textAnchor="middle"
                  y={yTextOffset}
                  fontSize={labelFontSize}
                  className={`select-none pointer-events-none transition-opacity duration-150
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent'}`}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                >
                  {cityToDisplay.name}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

    {selectedFeatureInfo && mapContainerRef.current && (
        <Card
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[60] transition-all duration-200 ease-out"
            style={{
                left: `${Math.min(selectedFeatureInfo.pageX + 15, mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 : 256) -15)}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                transform: selectedFeatureInfo.pageX > (mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 + 30 : 256 + 30)) 
                                ? 'translateX(calc(-100% - 30px))' 
                                : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} 
        >
            <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-lg font-bold leading-tight flex items-center text-primary">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                     {selectedFeatureInfo.feature.type && <p className="text-xs text-muted-foreground pt-0.5 pl-[1.375rem]">{selectedFeatureInfo.feature.type}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" onClick={closeInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
             {selectedFeatureInfo.feature.description && (
                <CardContent className="p-3">
                    <CardDescription className="text-xs text-muted-foreground line-clamp-3 !mt-1">
                      {selectedFeatureInfo.feature.description}
                    </CardDescription>
                </CardContent>
            )}
            {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 border-t pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
                    onClick={() => {
                        if(selectedFeatureInfo.feature.link) router.push(selectedFeatureInfo.feature.link);
                        closeInfoBox();
                    }}
                >
                    Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
                </Button>
            </CardFooter>
            )}
        </Card>
    )}

    {/* Loading indicator for details (if you re-add Firestore fetching) */}
    {isLoadingDetails && !isLoadingMapGeometry && (
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
