
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, Annotation } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology } from 'topojson-client';
import { getDistrictDescription } from '@/ai/flows/get-district-description-flow';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
// Firebase import is removed as per previous request to remove Firebase direct dependency from this component for details.

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // Key in TopoJSON objects holding the main geometry collection

// Combined type for feature properties that could be selected for the info box
// This type should encompass properties from both provinces/districts (derived from TopoJSON)
// and explicitly defined cities.
interface SelectedFeatureDisplayData {
  id: string;
  name: string;
  type: 'District' | 'City';
  population?: number; // Optional
  description?: string; // Optional, can be AI-generated for districts
  link?: string; // Optional but recommended
  properties?: any; // Original properties from GeoJSON/TopoJSON
  coordinates?: [number, number]; // For cities
  highlight?: boolean; // For cities
}

interface SelectedFeatureState {
  feature: SelectedFeatureDisplayData;
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null); // Holds GeoJSON features
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureState | null>(null);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const majorCities: CityMapData[] = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', description: "The vibrant capital, rich in culture and ancient temples.", population: 1442271, link: '/districts?name=Kathmandu', highlight: true },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', description: "A picturesque city by Phewa Lake with stunning Himalayan views.", population: 400000, link: '/districts?name=Kaski', highlight: true },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', description: "The sacred birthplace of Lord Buddha, a UNESCO World Heritage site.", population: 70000, link: '/districts?name=Rupandehi', highlight: true },
    { id: 'biratnagar', name: 'Biratnagar', coordinates: [87.2798, 26.4525], type: 'City', description: "Major industrial city and hub in Eastern Nepal.", population: 242548, link: '/districts?name=Morang', highlight: true },
    { id: 'nepalgunj', name: 'Nepalgunj', coordinates: [81.6167, 28.0500], type: 'City', description: "Key transport and trade hub in Western Nepal, near Indian border.", population: 138951, link: '/districts?name=Banke', highlight: true },
    { id: 'janakpur', name: 'Janakpur', coordinates: [85.9228, 26.7285], type: 'City', description: "Historic city, religious center, and birthplace of Goddess Sita.", population: 195438, link: '/districts?name=Dhanusha', highlight: true },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setMapData(null);
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const rawMapData: Topology = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON fetched. Objects keys:", Object.keys(rawMapData.objects || {}));

        if (rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          // @ts-ignore
          if (layer && (layer.type === "GeometryCollection" || layer.type === "MultiPolygon" || layer.type === "Polygon" || Array.isArray(layer.geometries))) {
            // @ts-ignore
            const geoJsonFeatures = topojsonFeature(rawMapData, layer).features as ExtendedFeature[];
            
            setMapData(geoJsonFeatures.map(f => ({
              ...f,
              properties: {
                ...f.properties,
                id: String(f.id || f.properties?.id || f.properties?.OBJECTID || f.properties?.DIST_EN || f.properties?.name || Math.random().toString(36).substring(7)),
                name: f.properties?.name || f.properties?.DIST_EN || f.properties?.ADM1_EN || "Unknown District",
                type: 'District', // Assuming these are districts
              }
            })));
          } else {
            throw new Error(`Layer "${TOPOJSON_OBJECT_KEY}" in TopoJSON is not a valid GeometryCollection or recognizable geometry type, or missing geometries.`);
          }
        } else {
          throw new Error(`Invalid TopoJSON data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property.`);
        }
      } catch (err) {
        let specificError = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        console.error("HomepageMap: fetchData error:", specificError);
        setFetchError(specificError);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchData();
  }, []);
  
  const handleFetchAiDescription = useCallback(async (districtName: string) => {
    if (!districtName) return;
    setIsFetchingDescription(true);
    setAiDescription(null); // Clear previous AI description
    try {
      console.log(`HomepageMap: Requesting AI description for district: ${districtName}`);
      const result = await getDistrictDescription({ districtName });
      if (result && result.description) {
        setAiDescription(result.description);
      } else {
        setAiDescription("AI description currently unavailable."); // Fallback for AI
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown AI description error";
      console.error(`HomepageMap: Error generating AI description for ${districtName}:`, errorMsg);
      toast({
        title: "AI Description Error",
        description: `Could not load AI details for ${districtName}.`,
        variant: "default",
      });
      setAiDescription("Could not load AI-powered insights for this district.");
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);


  const handleFeatureClick = useCallback((
    featureProperties: any,
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGElement | SVGGElement> // More generic type for SVG elements
  ) => {
    event.stopPropagation();

    const displayName = featureProperties?.name || featureProperties?.DIST_EN || featureProperties?.ADM1_EN || "Unknown Area";
    const featureId = String(featureProperties?.id || featureProperties?.rsmKey || displayName + Math.random());
    
    console.log(`${featureType} Clicked:`, displayName, "Event clientX:", event.clientX, "clientY:", event.clientY);
    
    let baseDescription = featureProperties?.description || `Explore ${displayName}, a diverse area in Nepal.`;
    let link = featureProperties?.link || `/districts?name=${encodeURIComponent(displayName)}`;
    let population = featureProperties?.population;

    const featureData: SelectedFeatureDisplayData = {
      id: featureId,
      name: displayName,
      type: featureType,
      population: population,
      description: baseDescription,
      link: link,
      properties: featureProperties, // Store original properties
      ...(featureType === 'City' && featureProperties.coordinates && { coordinates: featureProperties.coordinates }),
      ...(featureType === 'City' && typeof featureProperties.highlight !== 'undefined' && { highlight: featureProperties.highlight }),
    };

    setSelectedFeatureInfo({
      feature: featureData,
      pageX: event.clientX,
      pageY: event.clientY,
    });

    if (featureType === 'District') {
      handleFetchAiDescription(displayName);
    } else {
      setAiDescription(null); 
      setIsFetchingDescription(false);
    }
  }, [handleFetchAiDescription]);

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

  useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  let displayErrorMessage = fetchError;
  if (isLoadingMapGeometry) {
    // No error message while map is loading
  } else if (!mapData && !fetchError) {
    displayErrorMessage = "Map data is not available, but no specific fetch error occurred. Check TopoJSON path and content.";
  }


  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage?.includes("offline") || displayErrorMessage?.includes("Failed to get document") 
            ? "Could not connect to data service. Please verify your Firebase configuration and internet connection. Ensure Firestore is enabled." 
            : displayErrorMessage || "An unexpected error occurred and map data is unavailable."}
        </p>
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
        aria-label="Interactive map of Nepal showing districts"
      >
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ProvinceMapData; // Use a suitable type, ensure it has 'name' and 'id' or 'rsmKey'
                const districtName = properties?.name || "Unknown District";
                // Prefer geo.id if available from TopoJSON conversion, else rsmKey, else fallback.
                const geoId = String(geo.id || geo.rsmKey || properties?.id || districtName + Math.random());
                const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === 'District';
                
                return (
                  <Geography
                    key={geoId} 
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(properties, 'District', event)}
                    className={cn(
                      "outline-none transition-all duration-150 ease-out",
                      isSelected
                        ? 'fill-accent stroke-accent-foreground stroke-[1.5px]' // Prominent selected style
                        : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer'
                    )}
                    aria-label={districtName}
                  />
                );
              })
            }
          </Geographies>
           <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ProvinceMapData;
                const districtName = properties?.name || "Unknown District";
                const centroid = (geo as any).centroid as [number, number] | undefined;

                if (!centroid || !districtName ) return null;
                
                // Simple label filtering
                const showLabel = ["Kathmandu", "Kaski", "Morang", "Rupandehi", "Banke", "Humla", "Solukhumbu"].includes(districtName);
                if (!showLabel && districtName !== selectedFeatureInfo?.feature.name) return null;

                let fontSize = 5;
                if (districtName === "Kathmandu") fontSize = 7;


                return (
                  <Marker key={`label-${geo.rsmKey || properties.id}`} coordinates={centroid}>
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
          {majorCities.map((city) => {
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo?.feature.type === 'City';
            let labelFontSize = 6;
            if (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") {
                labelFontSize = city.name === "Kathmandu" ? 9 : 7;
            }

            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                onClick={(event) => handleFeatureClick(city, 'City', event as unknown as React.MouseEvent<SVGGElement>)}
              >
                <g
                  className={cn(
                    "transition-all group cursor-pointer",
                    isSelected ? 'text-accent' : 'text-primary hover:text-accent/80'
                  )}
                >
                  <circle
                    r={isSelected ? 6 : 4}
                    className={cn(
                      isSelected ? 'fill-accent stroke-accent-foreground' : 'fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground'
                    )}
                    strokeWidth={0.5}
                  />
                  <text
                    textAnchor="middle"
                    y={isSelected ? -10 : -8} 
                    fontSize={labelFontSize}
                    className={cn(
                      "select-none pointer-events-none transition-opacity duration-150 font-semibold",
                      isSelected ? 'opacity-100 fill-accent' : 'opacity-80 fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent'
                    )}
                     style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                  >
                    {city.name}
                  </text>
                </g>
              </Marker>
            );
          })}
      </ComposableMap>

      {selectedFeatureInfo && mapContainerRef.current && (
          <Card
            className={cn(
                "fixed p-0 w-60 sm:w-72 md:w-80 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[1000] transition-all duration-200 ease-out"
            )}
            style={{
                left: `${Math.min(selectedFeatureInfo.pageX + 15, (window.innerWidth) - (selectedFeatureInfo.pageX + 15 + (mapContainerRef.current.offsetWidth > 768 ? 320 : 256) > window.innerWidth ? ((mapContainerRef.current.offsetWidth > 768 ? 320 : 256) + 30) : 0)  )}px`,
                top: `${Math.min(selectedFeatureInfo.pageY + 15, (window.innerHeight) - 200 - 15 )}px`, // Approx height of info box (200px) + offset
                transform: selectedFeatureInfo.pageX + 15 + (mapContainerRef.current.offsetWidth > 768 ? 320 : 256) > window.innerWidth ? 'translateX(calc(-100% - 30px))' : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} 
          >
            <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-lg md:text-xl font-bold leading-tight flex items-center text-primary">
                        <MapPin className="w-4 h-4 md:w-5 md:h-5 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                     {selectedFeatureInfo.feature.type && <p className="text-xs text-muted-foreground pt-0.5 pl-[1.375rem]">{selectedFeatureInfo.feature.type}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleCloseInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-3 text-sm max-h-32 overflow-y-auto">
                {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <div className="flex items-center text-muted-foreground my-1 text-xs md:text-sm">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating description...
                    </div>
                )}
                {!isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && aiDescription && (
                     <p className="text-muted-foreground line-clamp-3 !mt-1 text-xs md:text-sm">{aiDescription}</p>
                )}
                {!isFetchingDescription && !(selectedFeatureInfo.feature.type === 'District' && aiDescription) && selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground line-clamp-3 !mt-1 text-xs md:text-sm">{selectedFeatureInfo.feature.description}</p>
                )}
                {!isFetchingDescription && !(selectedFeatureInfo.feature.type === 'District' && aiDescription) && !selectedFeatureInfo.feature.description && (
                    <p className="text-muted-foreground italic line-clamp-3 !mt-1 text-xs md:text-sm">Explore {selectedFeatureInfo.feature.name}, a notable area in Nepal.</p>
                )}

                 {selectedFeatureInfo.feature.population && (
                    <p className="text-muted-foreground/80 mt-1.5 text-[10px] md:text-xs">Population: {selectedFeatureInfo.feature.population.toLocaleString()}</p>
                )}
            </CardContent>
            {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 border-t pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs md:text-sm text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
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
    {isFetchingDescription && !isLoadingMapGeometry && (
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
