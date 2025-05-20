// src/components/maps/HomepageMap.tsx
"use client";

import type { ProvinceMapData, CityMapData, ExtendedFeature } from '@/types'; // Using existing types, ensure they match your data
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology, type Objects } from 'topojson-client';
import { getDistrictDescription } from '@/ai/flows/get-district-description-flow'; // Corrected import
import { useToast } from "@/hooks/use-toast";

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // The key in TopoJSON objects that holds the geometry collection

// Combine Province and City data types for the selected feature
interface SelectedFeatureDisplayInfo {
  feature: ExtendedFeature['properties'] & { type: 'District' | 'City', id: string, coordinates?: [number, number] };
  pageX: number;
  pageY: number;
}

const majorCities: Array<CityMapData & { id: string }> = [
  { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', highlight: true, description: "The vibrant capital city, rich in culture and ancient temples.", population: 1442271, link: '/districts?name=Kathmandu' },
  { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', highlight: true, description: "A picturesque city known for Phewa Lake and stunning Himalayan views.", population: 400000, link: '/districts?name=Kaski' },
  { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', highlight: true, description: "The sacred birthplace of Lord Buddha, a UNESCO World Heritage site.", population: 70000, link: '/districts?name=Rupandehi' },
];

export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const generateDescription = useCallback(async (featureName: string): Promise<string | null> => {
    if (!featureName) return null;
    setIsFetchingDescription(true);
    setAiDescription(null); // Clear previous AI description
    try {
      console.log(`HomepageMap: Calling API to generate description for district: ${featureName}`);
      const response = await fetch('/api/generate-district-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ districtName: featureName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to parse error response for ${featureName}. Status: ${response.status}` }));
        const errorMessage = errorData?.error || `Failed to generate description for ${featureName}. Status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data && data.description) {
        setAiDescription(data.description);
        console.log(`HomepageMap: AI Description for ${featureName}: ${data.description}`);
        return data.description;
      } else {
        console.warn(`HomepageMap: AI returned no description for ${featureName}`);
        setAiDescription(`Explore ${featureName}, a fascinating district in Nepal.`); // Fallback
        return `Explore ${featureName}, a fascinating district in Nepal.`;
      }
    } catch (err) {
      console.error(`HomepageMap: Error in generateDescription for ${featureName}:`, err);
      toast({
        title: "AI Description Error",
        description: `Could not generate AI description for ${featureName}. ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setAiDescription(`Information for ${featureName} is being updated. Discover its unique features!`); // More specific fallback
      return null;
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);


  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setSelectedFeatureInfo(null);

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
        console.log("HomepageMap: Raw TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 200) + "...");

        if (rawMapData && typeof rawMapData === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          if (layer && (layer.type === 'GeometryCollection' || (layer as any).geometries)) {
            const geoJsonFeatures = topojsonFeature(rawMapData, layer as Objects<any>).features as ExtendedFeature[];
            setMapData(geoJsonFeatures);
            console.log(`HomepageMap: TopoJSON processed into ${geoJsonFeatures.length} GeoJSON features.`);
          } else {
            const errorMsg = `Invalid TopoJSON structure: Layer key "${TOPOJSON_OBJECT_KEY}" does not contain a 'geometries' array or is not a GeometryCollection. Layer content: ${JSON.stringify(layer).substring(0,200)}...`;
            console.error("HomepageMap:", errorMsg);
            throw new Error(errorMsg);
          }
        } else {
          const errorMsg = `Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
      } catch (err) {
        console.error("HomepageMap: Error fetching or processing map geometry:", err);
        const specificError = err instanceof Error ? err.message : "An unknown error occurred while fetching map geometry.";
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };

    fetchData();
  }, []);

  const handleMapFeatureClick = useCallback((featureProperties: ExtendedFeature['properties'], event: React.MouseEvent | MouseEvent) => {
    event.stopPropagation();
    const featureName = featureProperties?.name || featureProperties?.DIST_EN || featureProperties?.ADM1_EN || "Unknown District";
    const featureId = String(featureProperties?.id || featureProperties?.OBJECTID || featureName + Math.random());
    
    console.log("Map Feature Clicked:", featureName, "Event clientX:", (event as React.MouseEvent).clientX, "clientY:", (event as React.MouseEvent).clientY);

    setSelectedFeatureInfo({
      feature: {
        ...featureProperties,
        id: featureId,
        name: featureName,
        type: 'District', // Assume districts from TopoJSON
        description: featureProperties?.description || `Explore ${featureName}, a district in Nepal.`,
        link: featureProperties?.link || `/districts?name=${encodeURIComponent(featureName)}`,
      },
      pageX: (event as React.MouseEvent).clientX,
      pageY: (event as React.MouseEvent).clientY,
    });
    if (featureName) {
      generateDescription(featureName);
    }
  }, [generateDescription]);

  const handleCityClick = useCallback((city: CityMapData & { id: string }, event: React.MouseEvent | MouseEvent) => {
    event.stopPropagation();
     console.log("City Clicked:", city.name, "Event clientX:", (event as React.MouseEvent).clientX, "clientY:", (event as React.MouseEvent).clientY);
    setSelectedFeatureInfo({
      feature: {
        ...city,
        type: 'City',
      },
      pageX: (event as React.MouseEvent).clientX,
      pageY: (event as React.MouseEvent).clientY,
    });
    setAiDescription(null); // No AI description for cities for now, or could call a different flow
    setIsFetchingDescription(false);
  }, []);

  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    setAiDescription(null);
    setIsFetchingDescription(false);
  }, []);


  let displayErrorMessage = fetchError;
  if (fetchError?.includes("offline") || fetchError?.includes("Failed to get document")) {
      displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
  } else if (fetchError?.includes("Invalid map data structure") || fetchError?.includes("404")) {
      displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}').`;
  }


  if (isLoadingMapGeometry || !mapData) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 dark:bg-muted/30 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Initializing Interactive Map of Nepal...</p>
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
      onClick={handleCloseInfoBox} // Close info box if map background is clicked
    >
       {/* Top-level debug indicator - REMOVE FOR PRODUCTION */}
       {/* {selectedFeatureInfo && (
        <div style={{ position: 'fixed', top: 0, left: 0, backgroundColor: 'rgba(0,255,0,0.7)', color: 'black', padding: '5px', zIndex: 100000 }}>
          DEBUG: Selected: {selectedFeatureInfo.feature.name} at X:{selectedFeatureInfo.pageX}, Y:{selectedFeatureInfo.pageY}
        </div>
      )} */}

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 2800,
          center: [84.1240, 28.3949]
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing districts and major cities"
      >
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map((geo: ExtendedFeature) => {
                const currentProperties = (geo.properties || {}) as ExtendedFeature['properties'];
                const districtName = currentProperties?.name || currentProperties?.DIST_EN || currentProperties?.ADM1_EN || "Unknown District";
                const geoId = String(geo.id || currentProperties?.id || geo.rsmKey || districtName + Math.random());
                
                const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === 'District';

                return (
                  <Geography
                    key={geoId}
                    geography={geo}
                    onClick={(event) => handleMapFeatureClick(currentProperties, event)}
                    className={
                      `transition-all duration-150 ease-out outline-none
                       ${isSelected 
                            ? 'fill-accent/70 dark:fill-accent/60 stroke-accent-foreground dark:stroke-accent-foreground/80 stroke-[1.5px]' 
                            : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer'
                       }`
                    }
                    aria-label={districtName}
                  />
                );
              })
            }
          </Geographies>

           <Geographies geography={mapData}>
            {({ geographies }) =>
                geographies.map(geo => {
                    const properties = (geo.properties || {}) as ExtendedFeature['properties'];
                    const districtName = properties?.name || properties?.DIST_EN || properties?.ADM1_EN || "";
                    const centroid = (geo as any).centroid as [number, number] | undefined; 

                    if (!centroid || !districtName) return null;

                    let fontSize = 5;
                    if (["Bagmati", "Lumbini", "Gandaki", "Koshi"].some(p => districtName.includes(p))) { // Simplified check
                        fontSize = districtName.includes("Bagmati") || districtName.includes("Lumbini") ? 6 : 5.5;
                    }
                    if (districtName.length > 15) fontSize = Math.max(3.5, fontSize - 1.5);
                    if (districtName.length > 20) fontSize = Math.max(3, fontSize - 1);

                    return (
                        <Marker key={`label-${geo.id || geo.rsmKey}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={0}
                                fontSize={fontSize}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground dark:fill-background pointer-events-none select-none"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                            >
                                {districtName.replace(" Province", "").replace(" Pradesh", "").replace(" District", "")}
                            </text>
                        </Marker>
                    );
                })
            }
          </Geographies>

          {majorCities.map((city) => {
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo.feature.type === 'City';
            let labelFontSize = 5;
            let yTextOffset = -8;
            if (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") {
                labelFontSize = city.name === "Kathmandu" ? 7 : 6; // Kathmandu slightly larger
                yTextOffset = city.name === "Kathmandu" ? -9 : -8.5;
            }
            
            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates!}
                onClick={(event) => handleCityClick(city, event)}
              >
                 <g className="cursor-pointer transition-all duration-150 group">
                  <circle
                    r={isSelected ? 6 : 4.5}
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
                  {city.name}
                </text>
              </Marker>
            );
          })}
    </ComposableMap>

    {selectedFeatureInfo && mapContainerRef.current && (
        <Card
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[1000] transition-all duration-200 ease-out"
            style={{
                left: `${Math.min(selectedFeatureInfo.pageX + 15, mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 : 256) - 15)}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                transform: selectedFeatureInfo.pageX > (mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 + 30 : 256 + 30)) 
                                ? 'translateX(calc(-100% - 30px))' 
                                : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent map click from closing this
        >
            <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-lg font-bold leading-tight flex items-center text-primary">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                     {selectedFeatureInfo.feature.type && <p className="text-xs text-muted-foreground pt-0.5 pl-[1.375rem]">{selectedFeatureInfo.feature.type}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" onClick={handleCloseInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-3 text-xs">
                {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
                    <div className="flex items-center text-muted-foreground">
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Generating description...
                    </div>
                )}
                {!isFetchingDescription && aiDescription && selectedFeatureInfo.feature.type === 'District' && (
                    <p className="text-muted-foreground line-clamp-3 !mt-1">{aiDescription}</p>
                )}
                {!isFetchingDescription && !aiDescription && selectedFeatureInfo.feature.type === 'District' && (
                    <p className="text-muted-foreground line-clamp-3 !mt-1">
                      {selectedFeatureInfo.feature.description || `Explore ${selectedFeatureInfo.feature.name}, a diverse place in Nepal.`}
                    </p>
                )}
                 {selectedFeatureInfo.feature.type === 'City' && selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground line-clamp-3 !mt-1">{selectedFeatureInfo.feature.description}</p>
                 )}
            </CardContent>
            {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 border-t pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
                    onClick={() => {
                        if(selectedFeatureInfo.feature.link) router.push(selectedFeatureInfo.feature.link);
                        handleCloseInfoBox();
                    }}
                >
                    Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
                </Button>
            </CardFooter>
            )}
        </Card>
    )}
    {isLoadingDetails && !isLoadingMapGeometry && !isFetchingDescription && ( // Show only if not already fetching AI desc
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
