// src/components/maps/HomepageMap.tsx
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData, ExtendedDistrictProperties } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology } from 'topojson-client';
import { getDistrictDescription } from '@/ai/flows/get-district-description-flow';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // Key in TopoJSON objects that holds the geometry collection

interface SelectedFeatureDetails {
  id: string;
  name: string;
  type: 'District' | 'City';
  description?: string;
  link?: string;
  population?: number;
  properties?: any; // Store original properties
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
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', highlight: true, description: "A picturesque city by Phewa Lake with stunning Himalayan views.", population: 400000, link: '/districts?name=Kaski' }, // Kaski is the district for Pokhara
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', highlight: true, description: "The sacred birthplace of Lord Buddha, a UNESCO World Heritage site.", population: 70000, link: '/districts?name=Rupandehi' }, // Rupandehi is the district for Lumbini
  ];


  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setMapData(null);
      setSelectedFeatureInfo(null);
      setAiDescription(null);

      try {
        console.log("HomepageMap: Fetching map data from:", NEPAL_GEO_URL);
        const geoRes = await fetch(NEPAL_GEO_URL);

        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`;
          console.error("HomepageMap: Fetch Error -", errorMsg);
          throw new Error(errorMsg);
        }

        const rawMapData: Topology = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON data fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 200) + "...");

        if (rawMapData && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY] && rawMapData.objects[TOPOJSON_OBJECT_KEY].type === "GeometryCollection") {
          const geoJsonFeatures = topojsonFeature(rawMapData, rawMapData.objects[TOPOJSON_OBJECT_KEY]!).features as ExtendedFeature[];
          
          if (!geoJsonFeatures || geoJsonFeatures.length === 0) {
            const errorMsg = `No geometries found in TopoJSON layer: ${TOPOJSON_OBJECT_KEY}`;
            console.error("HomepageMap: GeoJSON Conversion Error -", errorMsg);
            throw new Error(errorMsg);
          }
          setMapData(geoJsonFeatures);
          console.log(`HomepageMap: Successfully converted TopoJSON layer "${TOPOJSON_OBJECT_KEY}" to ${geoJsonFeatures.length} GeoJSON features.`);
        } else {
           const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property that is a GeometryCollection. Received: ${JSON.stringify(rawMapData).substring(0, 200)}...`;
          console.error("HomepageMap:", errorMsg);
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

  const generateDescription = useCallback(async (featureName: string, featureType: 'District' | 'City') => {
    if (featureType === 'City') {
      const cityData = majorCities.find(c => c.name === featureName);
      if (cityData?.description) {
        setAiDescription(cityData.description);
        setIsFetchingDescription(false);
        return;
      }
    }
    if (featureType === 'District') {
      setIsFetchingDescription(true);
      setAiDescription(null);
      try {
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
        } else {
          throw new Error("AI did not return a valid description.");
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown AI description error";
        console.error(`HomepageMap: Error generating AI description for ${featureName}:`, errorMsg);
        toast({
          title: "AI Description Error",
          description: `Could not generate description for ${featureName}.`,
          variant: "default",
        });
        setAiDescription(null); // Keep it null on error
      } finally {
        setIsFetchingDescription(false);
      }
    }
  }, [toast]);


  const handleFeatureClick = useCallback((
    featureProps: ExtendedDistrictProperties,
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGCircleElement>
  ) => {
    event.stopPropagation();

    const districtName = featureProps?.name || featureProps?.DIST_EN || featureProps?.ADM1_EN || "Unknown District";
    const featureId = String(featureProps?.id || (featureProps as any).rsmKey || featureProps?.OBJECTID || districtName + Math.random());

    const details = featureType === 'District'
      ? { description: featureProps?.description, link: featureProps?.link || `/districts?name=${encodeURIComponent(districtName)}`, population: featureProps?.population }
      : majorCities.find(c => c.id === featureId) || {};

    const featureData: SelectedFeatureDetails = {
      id: featureId,
      name: districtName,
      type: featureType,
      population: details.population,
      description: details.description,
      link: details.link || `/districts?name=${encodeURIComponent(districtName)}`,
      properties: featureProps,
    };
    
    setSelectedFeatureInfo({
      feature: featureData,
      pageX: event.pageX,
      pageY: event.pageY,
    });

    if (featureType === 'District') {
      generateDescription(districtName, 'District');
    } else if (featureType === 'City') {
      setAiDescription(details.description || null); // Use city's own description
      setIsFetchingDescription(false);
    }
  }, [generateDescription]);

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
        displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration and internet connection. Ensure Firestore is enabled. Original: ${fetchError}`;
    } else if (fetchError.includes("Invalid map data structure") || fetchError.includes("Expected TopoJSON with an 'objects.provinces' property")) {
        displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}').`;
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


  if (isLoadingMapGeometry || !mapData) {
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
        <Geographies geography={mapData}>
          {({ geographies }) =>
            geographies.map(geo => {
              const properties = geo.properties as ExtendedDistrictProperties;
              const districtName = properties?.name || properties?.DIST_EN || properties?.ADM1_EN || "Unknown District";
              const geoIdForSelection = String( (geo as any).id || properties?.id || properties?.OBJECTID || districtName + Math.random());
              const isSelected = selectedFeatureInfo?.feature.id === geoIdForSelection && selectedFeatureInfo.feature.type === 'District';
              
              return (
                <Geography
                  key={geoIdForSelection}
                  geography={geo}
                  onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(properties, 'District', event)}
                  className={cn(
                    "outline-none transition-all duration-150 ease-out",
                    isSelected
                      ? 'fill-accent stroke-accent-foreground stroke-[0.75px]' 
                      : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.25px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer'
                  )}
                  aria-label={districtName || "District"}
                />
              );
            })
          }
        </Geographies>
        {/* Render District Labels */}
        <Geographies geography={mapData}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const properties = (geo.properties || {}) as ExtendedDistrictProperties;
              const districtName = properties?.name || properties?.DIST_EN || properties?.ADM1_EN || "";
              const centroid = (geo as any).centroid as [number, number] | undefined;

              if (!centroid || !districtName) return null;

              let fontSize = 4;
              if (["Kathmandu", "Kaski", "Rupandehi", "Morang", "Jhapa", "Sunsari"].some(p => districtName.includes(p))) {
                  fontSize = 5;
              }

              return (
                <Marker key={`label-${(geo as any).id || districtName}`} coordinates={centroid}>
                  <text
                    x={0}
                    y={0}
                    fontSize={fontSize}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    className="fill-foreground/80 dark:fill-background/90 pointer-events-none select-none font-medium"
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
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
            if (city.name === "Kathmandu") labelFontSize = 7;
            else if (city.name === "Pokhara" || city.name === "Lumbini") labelFontSize = 6;

          return (
            <Marker
              key={city.id}
              coordinates={city.coordinates!}
              onClick={(event) => handleFeatureClick(city as any, 'City', event as unknown as React.MouseEvent<SVGCircleElement>)}
            >
              <circle
                r={isSelected ? 5 : 3.5}
                className={cn(
                  "transition-all group cursor-pointer",
                  isSelected
                    ? 'fill-accent stroke-accent-foreground'
                    : 'fill-primary stroke-primary-foreground hover:fill-accent/80 hover:stroke-accent-foreground'
                )}
                strokeWidth={0.5}
              />
              <text
                textAnchor="middle"
                y={-7}
                fontSize={labelFontSize}
                className={cn(
                  "select-none pointer-events-none transition-opacity duration-150 font-semibold",
                  isSelected ? 'opacity-100 fill-accent' : 'opacity-80 fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent'
                )}
                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
              >
                {city.name}
              </text>
            </Marker>
          );
        })}
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
                {!isFetchingDescription && aiDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <p className="text-muted-foreground line-clamp-4 !mt-1">{aiDescription}</p>
                )}
                {!isFetchingDescription && !aiDescription && selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground line-clamp-4 !mt-1">{selectedFeatureInfo.feature.description}</p>
                )}
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
    {/* Loading indicator for AI description (if a district is selected but description is still fetching) */}
    {isFetchingDescription && !isLoadingMapGeometry && (
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
