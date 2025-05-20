
// src/components/maps/HomepageMap.tsx
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react'; // Added Loader2
import { feature as topojsonFeature, type Topology, type Objects } from 'topojson-client';
import { getDistrictDescription } from '@/ai/flows/get-district-description-flow';
import { useToast } from "@/hooks/use-toast";

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // The key in TopoJSON objects that holds the geometry collection

// Combined type for selected feature information
interface SelectedFeatureDetails extends ProvinceMapData, Partial<CityMapData> {
  id: string;
  type: 'District' | 'City';
  // description is already in ProvinceMapData/CityMapData
  // link is already in ProvinceMapData/CityMapData
}

interface SelectedFeatureState {
  feature: SelectedFeatureDetails;
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [mapData, setMapData] = useState<any | null>(null); // Store raw TopoJSON object
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureState | null>(null);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const majorCities: Array<CityMapData & { coordinates: [number, number] }> = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', highlight: true, description: "The vibrant capital, rich in culture and ancient temples.", population: 1442271, link: '/districts?name=Kathmandu' },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', highlight: true, description: "A picturesque city by Phewa Lake with stunning Himalayan views.", population: 400000, link: '/districts?name=Kaski' },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', highlight: true, description: "The sacred birthplace of Lord Buddha, a UNESCO World Heritage site.", population: 70000, link: '/districts?name=Rupandehi' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setSelectedFeatureInfo(null);
      setAiDescription(null);

      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          let errorText = "Could not read error response.";
          try {
            errorText = await geoRes.text();
          } catch (e) {
            // ignore if reading text fails
          }
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
        const rawMapData: Topology = await geoRes.json();
        
        if (rawMapData && typeof rawMapData === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          console.log("HomepageMap: TopoJSON fetched successfully. Objects keys:", Object.keys(rawMapData.objects));
          setMapData(rawMapData);
        } else {
          const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0, 200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
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
  
  const generateAndSetDescription = useCallback(async (districtName: string) => {
    if (!districtName) return;
    setIsFetchingDescription(true);
    setAiDescription(null);
    try {
      const result = await getDistrictDescription({ districtName });
      if (result && typeof result.description === 'string' && result.description.trim() !== "") {
        setAiDescription(result.description);
      } else {
        setAiDescription(null);
        toast({
          title: "AI Description",
          description: `Could not generate a specific description for ${districtName}. Showing default info.`,
          variant: "default",
        });
      }
    } catch (err) {
      console.error(`Error fetching AI description for ${districtName}:`, err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error.';
      toast({
        title: "AI Description Error",
        description: `Failed to generate description for ${districtName}. ${errorMsg}`,
        variant: "destructive",
      });
      setAiDescription(null);
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);

  useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
    if (selectedFeatureInfo?.feature.type === 'District' && selectedFeatureInfo.feature.name) {
      generateAndSetDescription(selectedFeatureInfo.feature.name);
    } else {
      setAiDescription(null);
      setIsFetchingDescription(false);
    }
  }, [selectedFeatureInfo, generateAndSetDescription]);

  const handleFeatureClick = useCallback((
    featureProps: any, // Properties from TopoJSON feature or CityMapData
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGGElement | SVGCircleElement> // Allow circle for markers
  ) => {
    event.stopPropagation();
    const localDisplayName = featureProps?.name || featureProps?.DIST_EN || featureProps?.ADM1_EN || "Unknown Area";
    const localFeatureId = String(featureProps?.id || featureProps?.rsmKey || localDisplayName + Math.random());
    
    console.log(
      `${featureType} Clicked:`,
      localDisplayName,
      "Event pageX:", (event as React.MouseEvent).pageX, // Corrected access
      "pageY:", (event as React.MouseEvent).pageY, // Corrected access
      "Feature ID:", localFeatureId
    );

    const featureData: SelectedFeatureDetails = {
      id: localFeatureId,
      name: localDisplayName,
      type: featureType,
      description: featureProps.description || (featureType === 'District' ? `Explore ${localDisplayName}, a diverse district in Nepal.` : undefined),
      link: featureProps.link || `/districts?name=${encodeURIComponent(localDisplayName)}`,
      population: featureProps.population,
      properties: featureProps // Store all original properties
    };
    
    setSelectedFeatureInfo({
      feature: featureData,
      pageX: (event as React.MouseEvent).pageX,
      pageY: (event as React.MouseEvent).pageY,
    });
  }, []);

  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    setAiDescription(null);
    setIsFetchingDescription(false);
  }, []);
  
  const handleMapClick = useCallback(() => {
    if (selectedFeatureInfo) { 
        handleCloseInfoBox();
    }
  }, [selectedFeatureInfo, handleCloseInfoBox]);

  let displayErrorMessage = fetchError;
  if (fetchError) {
    if (fetchError.includes("offline") || fetchError.includes("Failed to get document")) {
        displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
    } else if (fetchError.includes("Invalid map data structure") || fetchError.includes("objects.nepal")) { // Updated to catch specific TopoJSON layer error
        displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}'). Layer content: ${mapData ? JSON.stringify(mapData.objects).substring(0,100) : 'N/A'}`;
    }
  }

  if (isLoadingMapGeometry && !fetchError) {
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
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable or malformed. Please ensure the TopoJSON file is correct and accessible in /public/data/."}</p>
      </div>
    );
  }
  
  // Check if the specific TopoJSON layer exists
  if (!mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY]) {
     console.error(`HomepageMap: TopoJSON layer "${TOPOJSON_OBJECT_KEY}" not found in mapData.objects. Available:`, mapData.objects ? Object.keys(mapData.objects) : "mapData.objects is undefined");
     return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
        <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Layer Error</p>
        <p className="text-sm">The required map layer ('{TOPOJSON_OBJECT_KEY}') was not found in the TopoJSON file. Please check the file structure.</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full h-full bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={handleMapClick} 
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 4000, 
          center: [84.1240, 28.3949] 
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing districts and major cities"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
          {/* Render District/Province Shapes */}
          <Geographies 
              geography={mapData} 
              parseGeographies={data => {
                if (!data || typeof data.objects !== 'object' || data.objects === null) {
                  console.error("parseGeographies (shapes): Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                  return [];
                }
                const key = TOPOJSON_OBJECT_KEY; 
                const layer = data.objects[key!];
                if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                    return layer.geometries;
                }
                console.error(`parseGeographies (shapes): Layer for key "${key}" is not a GeometryCollection or does not have 'geometries'. Layer type:`, layer?.type);
                return [];
              }}
            >
              {({ geographies }) =>
                geographies.map(geo => {
                  const featureProps = (geo.properties || {}) as ProvinceMapData['properties'] & { id?: string, rsmKey?: string };
                  const districtName = featureProps?.name || featureProps?.DIST_EN || featureProps?.ADM1_EN || "Unknown District";
                  const featureId = String(geo.id || geo.rsmKey || featureProps.id || districtName + Math.random());
                  
                  const isSelected = selectedFeatureInfo?.feature.type === 'District' && selectedFeatureInfo.feature.id === featureId;
                  
                  return (
                    <Geography
                      key={featureId}
                      geography={geo}
                      onClick={(event) => handleFeatureClick(geo.properties, 'District', event as unknown as React.MouseEvent<SVGPathElement>)}
                      className={
                        `transition-all duration-150 ease-out outline-none cursor-pointer
                         ${isSelected 
                              ? 'fill-accent stroke-accent-foreground stroke-[1px]' 
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
           <Geographies 
              geography={mapData}
              parseGeographies={data => {
                if (!data || typeof data.objects !== 'object' || data.objects === null) {
                  console.error("parseGeographies (labels): Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                  return [];
                }
                const key = TOPOJSON_OBJECT_KEY;
                const layer = data.objects[key!];
                if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                    return layer.geometries;
                }
                console.error(`parseGeographies (labels): Layer for key "${key}" is not a GeometryCollection or does not have 'geometries'. Layer type:`, layer?.type);
                return [];
              }}
            >
            {({ geographies }) =>
                geographies.map(geo => {
                    const properties = (geo.properties || {}) as ProvinceMapData['properties'];
                    const districtName = properties?.name || properties?.DIST_EN || properties?.ADM1_EN || "";
                    // @ts-ignore react-simple-maps typically adds centroid
                    const centroid = (geo as any).centroid as [number, number] | undefined; 

                    if (!centroid || !districtName) return null;

                    let fontSize = 5;
                    const highlightNames = ["Kathmandu", "Pokhara", "Lumbini"];
                    if (highlightNames.some(p => districtName.includes(p))) {
                         fontSize = (districtName === "Kathmandu") ? 9 : 7;
                    } else if (districtName.length > 12) fontSize = Math.max(3.5, fontSize - 1);
                     else if (districtName.length > 9) fontSize = Math.max(4, fontSize - 0.5);


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
            let labelFontSize = (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") ? 8 : 6;
            
            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates!}
                onClick={(event) => handleFeatureClick(city, 'City', event as unknown as React.MouseEvent<SVGGElement>)}
              >
                 <g className="cursor-pointer transition-all group">
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
                  y={city.name === "Kathmandu" ? -9 : -8} // Adjusted y offset for Kathmandu
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
        </ZoomableGroup>
    </ComposableMap>

    {/* Info Box Card - Positioned by cursor click */}
    {selectedFeatureInfo && mapContainerRef.current && (
        <Card
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[60] transition-all duration-200 ease-out"
            style={{
                left: `${Math.min(selectedFeatureInfo.pageX + 15, window.innerWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 : 256) -15 )}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                transform: selectedFeatureInfo.pageX > (window.innerWidth - ( (mapContainerRef.current.offsetWidth > 768 ? 288 : 256) +30) ) 
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
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" onClick={handleCloseInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-3 text-sm max-h-32 overflow-y-auto">
                {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <div className="flex items-center text-muted-foreground my-1">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating description...
                    </div>
                )}
                {/* AI Description */}
                {!isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && aiDescription && (
                     <p className="text-muted-foreground line-clamp-4 !mt-1">{aiDescription}</p>
                )}
                 {/* Fallback or City Description */}
                {!isFetchingDescription && (
                  (selectedFeatureInfo.feature.type === 'City' && selectedFeatureInfo.feature.description) || 
                  (selectedFeatureInfo.feature.type === 'District' && !aiDescription && selectedFeatureInfo.feature.description)
                ) && (
                     <p className="text-muted-foreground line-clamp-4 !mt-1">{selectedFeatureInfo.feature.description}</p>
                )}
                {/* Generic fallback if no other description exists for districts and AI hasn't loaded or failed */}
                 {!isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && !aiDescription && !selectedFeatureInfo.feature.description && (
                    <p className="text-muted-foreground italic line-clamp-4 !mt-1">Explore {selectedFeatureInfo.feature.name}, a diverse place in Nepal.</p>
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
    {isFetchingDescription && !isLoadingMapGeometry && !selectedFeatureInfo && ( 
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}

    