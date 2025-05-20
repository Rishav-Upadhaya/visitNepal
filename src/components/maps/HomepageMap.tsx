
// src/components/maps/HomepageMap.tsx
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback }
from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology, type Objects } from 'topojson-client';
import { getDistrictDescription } from '@/ai/flows/get-district-description-flow';
import { useToast } from "@/hooks/use-toast";

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // The key in TopoJSON objects that holds the geometry collection

interface SelectedFeatureInfo {
  feature: ProvinceMapData | CityMapData;
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureInfo | null>(null);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch TopoJSON map data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setSelectedFeatureInfo(null);
      setAiDescription(null);

      try {
        console.log(`HomepageMap: Fetching map geometry from ${NEPAL_GEO_URL}...`);
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text().catch(() => "Could not read error response body.");
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
        const rawMapData = await geoRes.json() as Topology;
        console.log("HomepageMap: Raw TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");

        if (rawMapData && typeof rawMapData === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
            // Convert TopoJSON to GeoJSON features
            const geoJsonFeatures = topojsonFeature(rawMapData, layer).features as ExtendedFeature[];
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
  
  const generateAndSetDescription = useCallback(async (featureName: string) => {
    if (!featureName) return;
    setIsFetchingDescription(true);
    setAiDescription(null);
    try {
      console.log(`HomepageMap: Calling API to generate description for district: ${featureName}`);
      const result = await getDistrictDescription({ districtName: featureName });
      
      if (result && typeof result.description === 'string' && result.description.trim() !== "") {
        setAiDescription(result.description);
        console.log(`HomepageMap: AI Description for ${featureName}: ${result.description}`);
      } else {
        console.warn(`HomepageMap: AI returned no valid description for ${featureName}. API Result:`, result);
        setAiDescription(`Discover ${featureName}, a unique district in Nepal with rich culture and stunning landscapes.`); // Fallback
      }
    } catch (err) {
      console.error(`HomepageMap: Error in generateAndSetDescription for ${featureName}:`, err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error generating description.';
      toast({
        title: "AI Description Error",
        description: `Could not generate AI description for ${featureName}. ${errorMsg}`,
        variant: "destructive",
      });
      setAiDescription(`Information for ${featureName} is being updated. Explore its rich heritage and natural beauty!`);
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);


  const handleFeatureClick = useCallback((featureData: ProvinceMapData | CityMapData, event: React.MouseEvent<SVGPathElement | SVGGElement>) => {
    event.stopPropagation();
    console.log(`${featureData.type} Clicked:`, featureData.name, "Event clientX:", event.clientX, "clientY:", event.clientY);
    
    setSelectedFeatureInfo({
      feature: featureData,
      pageX: event.clientX, 
      pageY: event.clientY,
    });

    if (featureData.type === 'District' && featureData.name) {
      generateAndSetDescription(featureData.name);
    } else {
      // For cities, we might use predefined description or skip AI gen
      setAiDescription(null);
      setIsFetchingDescription(false);
    }
  }, [generateAndSetDescription]);

  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    setAiDescription(null);
    setIsFetchingDescription(false);
  }, []);
  
  const handleMapClick = useCallback(() => {
    // Only close if not clicking on the info box itself
    if (selectedFeatureInfo) { // Check if an info box is open
        console.log("Map background clicked, closing info box.");
        handleCloseInfoBox();
    }
  }, [selectedFeatureInfo, handleCloseInfoBox]);

  if (isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 dark:bg-muted/30 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Initializing Interactive Map of Nepal...</p>
      </div>
    );
  }
  
  let displayErrorMessage = fetchError;
  if (fetchError) {
    if (fetchError.includes("offline") || fetchError.includes("Failed to get document")) {
        displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
    } else if (fetchError.includes("Invalid map data structure") || fetchError.includes("Invalid TopoJSON") || fetchError.includes("404")) {
        displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}'). Check console for details.`;
    }
  }

  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable. Please ensure your TopoJSON file is correctly placed in /public/data/ and check console for details."}</p>
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
        aria-label="Interactive map of Nepal showing districts and major cities"
      >
          {/* Render District/Province Shapes */}
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const currentProperties = (geo.properties || {}) as ProvinceMapData['properties'];
                const districtName = currentProperties?.name || currentProperties?.DIST_EN || currentProperties?.ADM1_EN || "Unknown District";
                const featureId = geo.rsmKey || String(currentProperties?.id || currentProperties?.OBJECTID || districtName + Math.random());
                
                const isSelected = selectedFeatureInfo?.feature.type === 'District' && selectedFeatureInfo.feature.id === featureId;
                
                const districtData: ProvinceMapData = {
                    id: featureId,
                    name: districtName,
                    type: 'District',
                    description: currentProperties?.description || `Explore ${districtName}, a diverse place in Nepal.`,
                    link: currentProperties?.link || `/districts?name=${encodeURIComponent(districtName)}`,
                    population: currentProperties?.population,
                    properties: currentProperties
                };

                return (
                  <Geography
                    key={featureId}
                    geography={geo}
                    onClick={(event) => handleFeatureClick(districtData, event as unknown as React.MouseEvent<SVGPathElement>)}
                    className={
                      `transition-all duration-150 ease-out outline-none cursor-pointer
                       ${isSelected 
                            ? 'fill-accent stroke-accent-foreground stroke-[1px]' // Solid accent fill for selected
                            : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30'
                       }`
                    }
                    aria-label={districtName}
                  />
                );
              })
            }
          </Geographies>

          {/* Render District/Province Labels */}
           <Geographies geography={mapData}>
            {({ geographies }) =>
                geographies.map(geo => {
                    const properties = (geo.properties || {}) as ProvinceMapData['properties'];
                    const districtName = properties?.name || properties?.DIST_EN || properties?.ADM1_EN || "";
                    const centroid = (geo as any).centroid as [number, number] | undefined; 

                    if (!centroid || !districtName) return null;

                    let fontSize = 5;
                    if (["Kathmandu", "Kaski", "Rupandehi", "Pokhara", "Lumbini"].some(p => districtName.includes(p))) {
                        fontSize = 6;
                    }
                    if (districtName.length > 15) fontSize = Math.max(3.5, fontSize - 1.5);
                    if (districtName === "Kathmandu" || districtName === "Pokhara" || districtName === "Lumbini") {
                         fontSize = districtName === "Kathmandu" ? 7 : 6;
                    }


                    return (
                        <Marker key={`label-${geo.rsmKey || districtName}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={0}
                                fontSize={fontSize}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground dark:fill-background pointer-events-none select-none"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                            >
                                {districtName}
                            </text>
                        </Marker>
                    );
                })
            }
          </Geographies>

          {/* Render Major City Markers */}
          {majorCities.map((city) => {
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo.feature.type === 'City';
            let labelFontSize = 5;
            let yTextOffset = -8; // Adjusted default offset

            if (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") {
                labelFontSize = (city.name === "Kathmandu") ? 7 : 6;
                yTextOffset = (city.name === "Kathmandu") ? -9 : -8.5; // Slightly more offset for larger font
            }
            
            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates!}
                onClick={(event) => handleFeatureClick(city, event as unknown as React.MouseEvent<SVGGElement>)}
              >
                 <g className="cursor-pointer transition-all duration-150 group">
                  <circle
                    r={isSelected ? 6 : 4.5}
                    className={isSelected 
                        ? 'fill-accent stroke-accent-foreground'
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

    {/* Info Box Card */}
    {selectedFeatureInfo && mapContainerRef.current && (
        <Card
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[60] transition-all duration-200 ease-out"
            style={{
                left: `${Math.min(selectedFeatureInfo.pageX + 15, mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 : 256) - 15)}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                transform: selectedFeatureInfo.pageX > (mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 + 30 : 256 + 30)) 
                                ? 'translateX(calc(-100% - 30px))' 
                                : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent map click from closing the box
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
            <CardContent className="p-3 text-sm">
                {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
                    <div className="flex items-center text-muted-foreground my-1">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating description...
                    </div>
                )}
                {selectedFeatureInfo.feature.type === 'District' && aiDescription && !isFetchingDescription && (
                     <p className="text-muted-foreground line-clamp-3 !mt-1">{aiDescription}</p>
                )}
                {/* Fallback or City Description */}
                {(!aiDescription || selectedFeatureInfo.feature.type === 'City') && selectedFeatureInfo.feature.description && !isFetchingDescription && (
                     <p className="text-muted-foreground line-clamp-3 !mt-1">{selectedFeatureInfo.feature.description}</p>
                )}
                {selectedFeatureInfo.feature.population && (
                    <p className="text-muted-foreground/80 mt-1.5 text-[11px]">Population: {selectedFeatureInfo.feature.population.toLocaleString()}</p>
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
    {isFetchingDescription && !isLoadingMapGeometry && !selectedFeatureInfo && ( // Show this only if a request is pending but no box is shown
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
