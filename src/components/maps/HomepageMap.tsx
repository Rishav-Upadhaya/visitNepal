
// src/components/maps/HomepageMap.tsx
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
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
const TOPOJSON_OBJECT_KEY = "nepal"; // Key for the district/province layer in TopoJSON

interface SelectedFeatureDisplayInfo {
  feature: ProvinceMapData | CityMapData; // Combined type
  pageX: number;
  pageY: number;
}

const majorCities: Array<CityMapData & { id: string }> = [
  { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', highlight: true, description: "The vibrant capital city, rich in culture and ancient temples.", population: 1442271, link: '/districts?name=Kathmandu' },
  { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', highlight: true, description: "A picturesque city known for Phewa Lake and stunning Himalayan views.", population: 400000, link: '/districts?name=Kaski' },
  { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', highlight: true, description: "The sacred birthplace of Lord Buddha, a UNESCO World Heritage site.", population: 70000, link: '/districts?name=Rupandehi' },
];

export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null); // Holds array of GeoJSON features
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);
  
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
        console.log("HomepageMap: Raw TopoJSON fetched. Keys in objects:", Object.keys(rawMapData.objects || {}));

        if (rawMapData && typeof rawMapData === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
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
      if (result && result.description) {
        setAiDescription(result.description);
        console.log(`HomepageMap: AI Description for ${featureName}: ${result.description}`);
      } else {
        console.warn(`HomepageMap: AI returned no description for ${featureName}`);
        setAiDescription(`Explore ${featureName}, a fascinating district in Nepal.`); // Fallback
      }
    } catch (err) {
      console.error(`HomepageMap: Error in generateDescription for ${featureName}:`, err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error generating description.';
      toast({
        title: "AI Description Error",
        description: `Could not generate AI description for ${featureName}. ${errorMsg}`,
        variant: "destructive",
      });
      setAiDescription(`Information for ${featureName} is being updated. Discover its unique features!`);
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);

  const handleFeatureClick = useCallback((featureProps: ExtendedFeature['properties'], event: React.MouseEvent<SVGPathElement> | MouseEvent) => {
    event.stopPropagation();
    const districtName = featureProps?.name || featureProps?.DIST_EN || featureProps?.ADM1_EN || "Unknown District";
    const featureId = String(featureProps?.id || featureProps?.OBJECTID || districtName + Math.random());

    console.log("District Clicked:", districtName, "Event clientX:", (event as React.MouseEvent).clientX, "clientY:", (event as React.MouseEvent).clientY);
    
    const featureData: ProvinceMapData = {
      id: featureId,
      name: districtName,
      type: 'District',
      description: featureProps?.description || `Discover more about ${districtName}.`,
      link: featureProps?.link || `/districts?name=${encodeURIComponent(districtName)}`,
      population: featureProps?.population, // Assuming population might be in properties
    };

    setSelectedFeatureInfo({
      feature: featureData,
      pageX: (event as React.MouseEvent).clientX,
      pageY: (event as React.MouseEvent).clientY,
    });

    if (districtName !== "Unknown District") {
      generateAndSetDescription(districtName);
    } else {
      setAiDescription(null);
      setIsFetchingDescription(false);
    }
  }, [generateAndSetDescription]);

  const handleCityClick = useCallback((city: CityMapData & { id: string }, event: React.MouseEvent<SVGPathElement> | MouseEvent) => {
    event.stopPropagation();
    console.log("City Clicked:", city.name, "Event clientX:", (event as React.MouseEvent).clientX, "clientY:", (event as React.MouseEvent).clientY);
    
    setSelectedFeatureInfo({
      feature: city, // CityMapData already has the required fields
      pageX: (event as React.MouseEvent).clientX,
      pageY: (event as React.MouseEvent).clientY,
    });
    // No AI description for cities from this flow for now, uses predefined city.description
    setAiDescription(null); 
    setIsFetchingDescription(false);
  }, []);

  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    setAiDescription(null);
    setIsFetchingDescription(false);
  }, []);
  
  if (isLoadingMapGeometry || !mapData) {
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
        displayErrorMessage = `Map Error: Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
    } else if (fetchError.includes("Invalid GeoJSON") || fetchError.includes("Invalid TopoJSON") || fetchError.includes("404")) {
        displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}'). Original: ${fetchError}`;
    }
  }

  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable. Please check the console for details."}</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full aspect-[16/9] bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={handleCloseInfoBox}
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
              geographies.map((geo: ExtendedFeature) => {
                const currentProperties = (geo.properties || {}) as ProvinceMapData['properties'];
                const geoKey = geo.rsmKey || String(currentProperties?.id || currentProperties?.name || Math.random());
                const isSelected = selectedFeatureInfo?.feature.id === geoKey && selectedFeatureInfo.feature.type === 'District';
                
                return (
                  <Geography
                    key={geoKey}
                    geography={geo}
                    onClick={(event) => handleFeatureClick(currentProperties, event)}
                    className={
                      `transition-all duration-150 ease-out outline-none
                       ${isSelected 
                            ? 'fill-accent stroke-accent-foreground stroke-[1.5px]' 
                            : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer'
                       }`
                    }
                    aria-label={currentProperties?.name || "Nepalese district"}
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
                    if (["Kathmandu", "Kaski", "Rupandehi"].some(p => districtName.includes(p))) {
                        fontSize = 6;
                    }
                    if (districtName.length > 15) fontSize = Math.max(3.5, fontSize - 1.5);

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
            let yTextOffset = -8;

            if (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") {
                labelFontSize = (city.name === "Kathmandu") ? 7 : 6;
                yTextOffset = (city.name === "Kathmandu") ? -9 : -8.5;
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

    {/* Info Box */}
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
            <CardContent className="p-3 text-xs">
                {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
                    <div className="flex items-center text-muted-foreground my-1">
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Generating description...
                    </div>
                )}
                {/* Display AI description or fallback */}
                <p className="text-muted-foreground line-clamp-3 !mt-1">
                  {selectedFeatureInfo.feature.type === 'District' && aiDescription ? aiDescription : selectedFeatureInfo.feature.description || `Explore ${selectedFeatureInfo.feature.name}, a diverse place in Nepal.`}
                </p>
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
    {isFetchingDescription && !isLoadingMapGeometry && ( 
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}

