
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology } from 'topojson-client';
import { getDistrictDescription } from '@/ai/flows/get-district-description-flow'; 
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; 
const TOPOJSON_OBJECT_KEY = "nepal"; 

// Combined type for feature properties that could be selected for the info box
type SelectedFeatureDisplayData = (ProvinceMapData | CityMapData) & {
  id: string;
  name: string;
  type: 'District' | 'City';
  description?: string;
  link?: string;
  population?: number; 
};


interface SelectedFeatureState {
  feature: SelectedFeatureDisplayData;
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
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', description: "The vibrant capital, rich in culture and ancient temples.", population: 1442271, link: '/districts?name=Kathmandu' },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', description: "A picturesque city by Phewa Lake with stunning Himalayan views.", population: 400000, link: '/districts?name=Kaski' },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', description: "The sacred birthplace of Lord Buddha, a UNESCO World Heritage site.", population: 70000, link: '/districts?name=Rupandehi' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setMapData(null);
      setSelectedFeatureInfo(null);
      setAiDescription(null);

      try {
        console.log("HomepageMap: Fetching map data from", NEPAL_GEO_URL);
        const geoRes = await fetch(NEPAL_GEO_URL);

        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }

        const rawMapData: Topology = await geoRes.json();
        
        if (rawMapData && rawMapData.type === "Topology" && rawMapData.objects && typeof rawMapData.objects === 'object' && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
            console.log(`HomepageMap: TopoJSON processed. Using object key: "${TOPOJSON_OBJECT_KEY}"`);
            const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
            if (!layer || (layer.type !== "GeometryCollection" && !layer.geometries) && (!["Polygon", "MultiPolygon"].includes(layer.type || "") || !layer.arcs)) {
                 throw new Error(`TopoJSON layer "${TOPOJSON_OBJECT_KEY}" is not a valid GeometryCollection or single Geometry.`);
            }

            const geoJsonFeatures = topojsonFeature(rawMapData, layer!).features as ExtendedFeature[];
            
            if (!geoJsonFeatures || geoJsonFeatures.length === 0) {
              throw new Error(`No geometries found in TopoJSON layer: ${TOPOJSON_OBJECT_KEY}`);
            }
            
            setMapData(geoJsonFeatures.map(f => ({
              ...f,
              properties: {
                ...f.properties,
                name: f.properties?.name || f.properties?.DIST_EN || f.properties?.ADM1_EN || "Unknown District",
                id: String(f.id || f.properties?.id || f.properties?.OBJECTID || f.properties?.name || Math.random())
              }
            })));
        } else {
          const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0, 200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
        }
      } catch (err) {
        console.error("HomepageMap: Error during map data fetching or processing:", err);
        let specificError = err instanceof Error ? err.message : "An unknown error occurred while fetching map data.";
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchData();
  }, []);

  const generateAndSetDescription = useCallback(async (featureName: string) => {
    setIsFetchingDescription(true);
    setAiDescription(null); 
    try {
      console.log(`HomepageMap: Generating description for district: ${featureName}`);
      const result = await getDistrictDescription({ districtName: featureName });
      if (result && result.description) {
        setAiDescription(result.description);
      } else {
        throw new Error("AI did not return a valid description.");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown AI description error";
      console.error(`HomepageMap: Error generating AI description for ${featureName}:`, errorMsg);
      toast({
        title: "AI Description Error",
        description: `Could not load details for ${featureName}.`,
        variant: "default", 
      });
      setAiDescription(null); 
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);

  const handleFeatureClick = useCallback((
    featureProps: any, 
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGCircleElement>
  ) => {
    event.stopPropagation();

    const localDisplayName = featureProps?.name || "Unknown Area";
    const localFeatureId = String(featureProps?.id || featureProps?.OBJECTID || featureProps?.rsmKey || localDisplayName + Math.random());
    
    console.log(`${featureType} Clicked:`, localDisplayName, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature ID:", localFeatureId);
    
    let featureData: SelectedFeatureDisplayData;

    if (featureType === 'District') {
        featureData = {
            id: localFeatureId,
            name: localDisplayName,
            type: 'District',
            description: featureProps?.description || `Explore ${localDisplayName}, a diverse district in Nepal.`,
            link: featureProps?.link || `/districts?name=${encodeURIComponent(localDisplayName)}`,
            population: featureProps?.population
        };
        generateAndSetDescription(localDisplayName); 
    } else { // City
        const city = majorCities.find(c => c.name === localDisplayName || c.id === localDisplayName); 
        featureData = {
            id: city?.id || localFeatureId,
            name: localDisplayName,
            type: 'City',
            description: city?.description || `Welcome to ${localDisplayName}.`,
            link: city?.link || `/districts?name=${encodeURIComponent(localDisplayName)}`, 
            population: city?.population
        };
        setAiDescription(city?.description || null); 
        setIsFetchingDescription(false);
    }

    setSelectedFeatureInfo({
      feature: featureData,
      pageX: event.pageX,
      pageY: event.pageY,
    });
  }, [generateAndSetDescription, majorCities]);

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
        displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration and internet connection. Original: ${fetchError}`;
    } else if (fetchError.includes("Invalid map data structure") || fetchError.includes(`objects.${TOPOJSON_OBJECT_KEY}`) || fetchError.includes("No geometries found")) {
        displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}') with geometries.`;
    } else if (fetchError.includes("404")) {
        displayErrorMessage = `Map Error: The map data file (${NEPAL_GEO_URL}) was not found. Please ensure it exists in your /public/data directory.`;
    }
  }

  if (isLoadingMapGeometry) {
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
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable or invalid. Please ensure the TopoJSON file is correct and accessible."}</p>
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
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
            <Geographies 
              geography={mapData} 
            >
              {({ geographies }) =>
                geographies.map(geo => {
                  const properties = geo.properties as ProvinceMapData; 
                  const districtName = properties?.name || "Unknown District";
                  const geoIdForSelection = String(geo.id || properties?.id || districtName + Math.random());
                  const isSelected = selectedFeatureInfo?.feature.id === geoIdForSelection && selectedFeatureInfo.feature.type === 'District';
                  
                  return (
                    <Geography
                      key={geo.rsmKey || geoIdForSelection} 
                      geography={geo}
                      onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(properties, 'District', event)}
                      className={cn(
                        "outline-none transition-all duration-150 ease-out",
                        isSelected
                          ? 'fill-accent stroke-accent-foreground stroke-[1.5px]' 
                          : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer'
                      )}
                      aria-label={districtName}
                    />
                  );
                })
              }
            </Geographies>
            <Geographies 
              geography={mapData}
            >
              {({ geographies }) =>
                geographies.map((geo) => {
                  const properties = (geo.properties || {}) as ProvinceMapData;
                  const districtName = properties?.name || "";
                  const centroid = (geo as any).centroid as [number, number] | undefined; 

                  if (!centroid || !districtName) return null;

                  let fontSize = (districtName === "Kathmandu" || districtName === "Pokhara" || districtName === "Lumbini") 
                                  ? (districtName === "Kathmandu" ? 7 : 6) 
                                  : 4;

                  return (
                    <Marker key={`label-${geo.rsmKey || districtName}`} coordinates={centroid}>
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
              const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo.feature.type === 'City';
              let labelFontSize = (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") ? 
                                  (city.name === "Kathmandu" ? 9 : 7) 
                                  : 6;
              return (
                <Marker
                  key={city.id}
                  coordinates={city.coordinates!}
                  onClick={(event) => handleFeatureClick(city, 'City', event as unknown as React.MouseEvent<SVGCircleElement>)}
                >
                  <circle
                    r={isSelected ? 6: 4}
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
                </Marker>
              );
            })}
        </ZoomableGroup>
      </ComposableMap>

      {selectedFeatureInfo && mapContainerRef.current && (
          <Card
            className={cn(
                "fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[1000] transition-all duration-200 ease-out"
            )}
            style={{
                left: `${Math.min(selectedFeatureInfo.pageX + 15, (mapContainerRef.current?.offsetWidth || window.innerWidth) - (mapContainerRef.current?.offsetWidth > 768 ? 288 : 256) - 15 )}px`,
                top: `${Math.min(selectedFeatureInfo.pageY + 15, (mapContainerRef.current?.offsetHeight || window.innerHeight) - 200 - 15 )}px`, 
                 transform: selectedFeatureInfo.pageX > ((mapContainerRef.current?.offsetWidth || window.innerWidth) - ( (mapContainerRef.current?.offsetWidth > 768 ? 288 : 256) + 30) ) 
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
                    <p className="text-muted-foreground italic line-clamp-4 !mt-1">Explore {selectedFeatureInfo.feature.name}, a significant area in Nepal.</p>
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
    {isFetchingDescription && !isLoadingMapGeometry && (
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}

