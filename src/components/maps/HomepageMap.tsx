// src/components/maps/HomepageMap.tsx
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData, ExtendedDistrictProperties } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology, type Objects } from 'topojson-client';
import { getDistrictDescription } from '@/ai/flows/get-district-description-flow';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';


const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal";

interface SelectedFeatureDetails {
  id: string;
  name: string;
  type: 'District' | 'City';
  description?: string;
  link?: string;
  population?: number;
  properties?: any;
}

interface SelectedFeatureState {
  feature: SelectedFeatureDetails;
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
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
          const errorText = await geoRes.text();
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0,200)}...`;
          console.error("HomepageMap: Fetch Error -", errorMsg);
          throw new Error(errorMsg);
        }
        const rawMapData: Topology = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON data fetched successfully. Objects found:", Object.keys(rawMapData.objects || {}));

        if (rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY] && rawMapData.objects[TOPOJSON_OBJECT_KEY].type === "GeometryCollection") {
          const geoJsonFeatures = topojsonFeature(rawMapData, rawMapData.objects[TOPOJSON_OBJECT_KEY]!).features as ExtendedFeature[];
          
          if (!geoJsonFeatures || geoJsonFeatures.length === 0) {
            const errorMsg = `No geometries found in TopoJSON layer: ${TOPOJSON_OBJECT_KEY}`;
            console.error("HomepageMap: GeoJSON Conversion Error -", errorMsg);
            throw new Error(errorMsg);
          }
          
          setMapData(geoJsonFeatures);
          console.log(`HomepageMap: Successfully converted TopoJSON layer "${TOPOJSON_OBJECT_KEY}" to ${geoJsonFeatures.length} GeoJSON features.`);
        } else {
          const errorMsg = `Invalid TopoJSON data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property that is a GeometryCollection. Available objects: ${rawMapData.objects ? Object.keys(rawMapData.objects).join(', ') : 'N/A'}`;
          console.error("HomepageMap: TopoJSON Structure Error -", errorMsg, "Received data:", rawMapData);
          throw new Error(errorMsg);
        }
      } catch (err) {
        console.error("HomepageMap: Error during data fetching or processing:", err);
        let specificError = err instanceof Error ? err.message : "An unknown error occurred while fetching map data.";
         if (specificError.includes("offline") || specificError.includes("Failed to get document")) {
            specificError = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${specificError}`;
        }
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchData();
  }, []);

  const generateAIDescription = useCallback(async (featureName: string, featureType: 'District' | 'City') => {
      if (featureType === 'City') { 
          const cityData = majorCities.find(c => c.name === featureName);
          if (cityData?.description) {
              setAiDescription(cityData.description);
              setIsFetchingDescription(false);
              return;
          }
      }
      if(featureType === 'District') { 
        setIsFetchingDescription(true);
        setAiDescription(null); 
        try {
          console.log(`HomepageMap: Fetching AI description for district: ${featureName}`);
          // Simulate API call if needed, or directly call the flow if it's a server action
          const response = await fetch('/api/generate-district-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ districtName: featureName }),
          });

          if (!response.ok) {
            throw new Error(`Failed to generate description for ${featureName}. Status: ${response.status}`);
          }
          
          const data = await response.json();
          if (data && data.description) {
            setAiDescription(data.description);
            console.log(`HomepageMap: AI description for ${featureName}: ${data.description}`);
          } else {
            throw new Error("AI did not return a valid description.");
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown AI description error";
          console.error(`HomepageMap: Error generating AI description for ${featureName}:`, errorMsg);
          toast({
            title: "AI Description Error",
            description: `Could not generate description for ${featureName}. ${errorMsg.substring(0,100)}`,
            variant: "destructive",
          });
          setAiDescription(null); 
        } finally {
          setIsFetchingDescription(false);
        }
      }
  }, [toast]);

 useEffect(() => {
    if (selectedFeatureInfo?.feature.type === 'District' && selectedFeatureInfo.feature.name) {
        generateAIDescription(selectedFeatureInfo.feature.name, 'District');
    } else if (selectedFeatureInfo?.feature.type === 'City' && selectedFeatureInfo.feature.name){
        const cityData = majorCities.find(c => c.id === selectedFeatureInfo.feature.id);
        setAiDescription(cityData?.description || null);
        setIsFetchingDescription(false);
    }
  }, [selectedFeatureInfo, generateAIDescription]);


  const handleFeatureClick = useCallback((
    geoOrCityData: any, 
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGCircleElement> 
  ) => {
    event.stopPropagation(); 

    let featureName: string;
    let featureId: string;
    let description: string | undefined = undefined;
    let link: string | undefined = undefined;
    let population: number | undefined = undefined;
    let properties: any = {};

    if (featureType === 'District') {
        const districtProperties = geoOrCityData.properties as ExtendedDistrictProperties;
        featureName = districtProperties.name || districtProperties.DIST_EN || districtProperties.ADM1_EN || "Unknown District";
        featureId = String(geoOrCityData.rsmKey || districtProperties.id || districtProperties.name || `district-${Math.random()}`);
        description = districtProperties.description || `Explore ${featureName}, a diverse region in Nepal.`;
        link = districtProperties.link || `/districts?name=${encodeURIComponent(featureName)}`;
        population = districtProperties.population;
        properties = districtProperties;
    } else { 
        const city = geoOrCityData as CityMapData; 
        featureName = city.name;
        featureId = String(city.id);
        description = city.description;
        link = city.link;
        population = city.population;
        properties = city; 
    }
    
    console.log(`${featureType} Clicked:`, featureName, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature ID:", featureId);
    
    setSelectedFeatureInfo({
        feature: {
            id: featureId,
            name: featureName,
            type: featureType,
            description: description,
            link: link,
            population: population,
            properties: properties,
        },
        pageX: event.pageX,
        pageY: event.pageY,
    });
  }, []); // Removed generateAIDescription from here, it's handled by useEffect

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
    } else if (fetchError.includes("Invalid TopoJSON") || fetchError.includes(`objects.${TOPOJSON_OBJECT_KEY}`) || fetchError.includes("No geometries found") || fetchError.includes("Failed to fetch map data")) {
        displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}') with geometries. Details: ${fetchError.substring(0,250)}...`;
    }
  }
  
  if (displayErrorMessage || (!isLoadingMapGeometry && !mapData)) { 
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable. Please ensure the TopoJSON file is correct and accessible."}</p>
      </div>
    );
  }

  if (isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 dark:bg-muted/30 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Initializing Interactive Map of Nepal...</p>
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
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1} minZoom={0.75} maxZoom={8}>
          {/* Render District Shapes */}
          {mapData && (
            <Geographies geography={mapData}> 
              {({ geographies }) =>
                geographies.map((geo, index) => {
                  const districtProperties = geo.properties as ExtendedDistrictProperties;
                  const geoIdForSelection = String(geo.rsmKey || districtProperties.id || districtProperties.name || `district-${index}`);
                  const isSelected = selectedFeatureInfo?.feature.id === geoIdForSelection && selectedFeatureInfo.feature.type === 'District';
                  
                  return (
                    <Geography
                      key={geoIdForSelection}
                      geography={geo}
                      onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(geo, 'District', event)}
                      className={cn(
                        "outline-none transition-all duration-150 ease-out",
                        isSelected
                          ? 'fill-destructive stroke-destructive-foreground stroke-[0.75px]' 
                          : 'fill-primary/10 dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.25px] hover:fill-primary/30 dark:hover:fill-accent/30 cursor-pointer'
                      )}
                      aria-label={districtProperties.name || "District"}
                    />
                  );
                })
              }
            </Geographies>
          )}

          {/* Render District Labels */}
           {mapData && (
            <Geographies geography={mapData}>
            {({ geographies }) =>
                geographies.map((geo, index) => {
                    const properties = (geo.properties || {}) as ExtendedDistrictProperties;
                    const districtName = properties?.name || properties?.DIST_EN || properties?.ADM1_EN || "";
                    // @ts-ignore react-simple-maps typically adds centroid
                    const centroid = (geo as any).centroid as [number, number] | undefined; 

                    if (!centroid || !districtName) return null;

                    let fontSize = 4; 
                     if (["Kathmandu", "Kaski", "Rupandehi"].some(p => districtName.includes(p))) { 
                         fontSize = 6;
                    }

                    return (
                        <Marker key={`label-${geo.rsmKey || districtName}-${index}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={0}
                                fontSize={fontSize}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground/70 dark:fill-background/80 pointer-events-none select-none font-medium"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                            >
                                {districtName}
                            </text>
                        </Marker>
                    );
                })
            }
            </Geographies>
           )}

          {/* Render Major City Markers */}
          {majorCities.map((city) => {
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo.feature.type === 'City';
            let labelFontSize = 6;
            if (city.name === "Kathmandu") labelFontSize = 9;
            else if (city.name === "Pokhara" || city.name === "Lumbini") labelFontSize = 7;
            
            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates!}
                onClick={(event) => handleFeatureClick(city, 'City', event as unknown as React.MouseEvent<SVGCircleElement>)} 
              >
                 <circle
                    r={isSelected ? 6 : 4.5}
                    className={cn(
                        "transition-all group cursor-pointer",
                        isSelected 
                        ? 'fill-accent stroke-accent-foreground'
                        : 'fill-primary stroke-primary-foreground hover:fill-accent/80 hover:stroke-accent-foreground'
                    )}
                    strokeWidth={0.75}
                  />
                <text
                  textAnchor="middle"
                  y={-8} 
                  fontSize={labelFontSize}
                  className={cn(`select-none pointer-events-none transition-opacity duration-150 font-semibold`,
                    isSelected ? 'opacity-100 fill-accent' : 'opacity-80 fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent'
                  )}
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
                left: `${Math.min(selectedFeatureInfo.pageX + 15, (mapContainerRef.current?.offsetWidth || window.innerWidth) - (mapContainerRef.current?.offsetWidth > 768 ? 288 : 256) -15 )}px`,
                top: `${Math.min(selectedFeatureInfo.pageY + 15, (mapContainerRef.current?.offsetHeight || window.innerHeight) - 150)}px`, 
                transform: selectedFeatureInfo.pageX > ((mapContainerRef.current?.offsetWidth || window.innerWidth) - ( (mapContainerRef.current?.offsetWidth > 768 ? 288 : 256) +30) ) 
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
                {!isFetchingDescription && aiDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <p className="text-muted-foreground line-clamp-4 !mt-1">{aiDescription}</p>
                )}
                {/* Fallback to feature's own description if AI one is not available/fetched for District OR for City */}
                {!isFetchingDescription && !aiDescription && selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground line-clamp-4 !mt-1">{selectedFeatureInfo.feature.description}</p>
                )}
                {/* Ultimate fallback if no description at all */}
                {!isFetchingDescription && !aiDescription && !selectedFeatureInfo.feature.description && selectedFeatureInfo.feature.type === 'District' && (
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
    {/* General loading indicator for AI description (if a district is selected but map is not in error/loading state) */}
    {isFetchingDescription && !isLoadingMapGeometry && !fetchError && (
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
