
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, Annotation } from 'react-simple-maps';
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

interface SelectedFeatureDisplayData {
  id: string;
  name: string;
  type: 'District' | 'City';
  population?: number;
  description?: string; // This will hold AI or default description
  originalDescription?: string; // From TopoJSON properties or majorCities array
  link?: string;
  properties?: any;
}

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
      console.log("HomepageMap: Attempting to fetch map data from", NEPAL_GEO_URL);

      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        
        const rawMapData: Topology = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON fetched successfully. Objects keys:", Object.keys(rawMapData.objects || {}));

        if (rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          // @ts-ignore
          if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries) && layer.geometries.length > 0) {
            // @ts-ignore
            const geoJsonFeatures = topojsonFeature(rawMapData, layer!).features as ExtendedFeature[];
            
            if (geoJsonFeatures && geoJsonFeatures.length > 0) {
              setMapData(geoJsonFeatures.map(f => ({
                ...f,
                properties: {
                  ...f.properties,
                  id: String(f.id || f.properties?.id || f.properties?.OBJECTID || f.properties?.DIST_EN || f.properties?.name || Math.random().toString(36).substring(7)),
                  name: f.properties?.name || f.properties?.DIST_EN || f.properties?.ADM1_EN || "Unknown District",
                  type: 'District', // Set type for these features
                  description: f.properties?.description || `Explore ${f.properties?.name || f.properties?.DIST_EN || 'this district'}, a diverse region in Nepal.`, // Default description
                  link: f.properties?.link || `/districts?name=${encodeURIComponent(f.properties?.name || f.properties?.DIST_EN || '')}`
                }
              })));
            } else {
              const errorMsg = `Failed to extract or convert valid geometries from TopoJSON layer '${TOPOJSON_OBJECT_KEY}' in ${NEPAL_GEO_URL}. The layer might be empty or malformed.`;
              console.error("HomepageMap:", errorMsg, "Layer:", layer);
              setFetchError(errorMsg);
              setMapData(null);
            }
          } else {
            const errorMsg = `Invalid TopoJSON structure: Layer '${TOPOJSON_OBJECT_KEY}' in ${NEPAL_GEO_URL} is not a GeometryCollection or has no geometries. Layer type: ${layer?.type}`;
            console.error("HomepageMap:", errorMsg, "Layer:", layer);
            setFetchError(errorMsg);
            setMapData(null);
          }
        } else {
          const errorMsg = `Invalid TopoJSON structure: 'objects.${TOPOJSON_OBJECT_KEY}' not found in the fetched data from ${NEPAL_GEO_URL}. Available objects: ${Object.keys(rawMapData.objects || {}).join(', ')}`;
          console.error("HomepageMap:", errorMsg, "Raw Data:", rawMapData);
          setFetchError(errorMsg);
          setMapData(null);
        }
      } catch (err) {
        let specificError = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        console.error("HomepageMap: fetchData error:", specificError, err);
        setFetchError(specificError); // Set fetchError here
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchData();
  }, []);

 const fetchAiDescriptionAndUpdateState = useCallback(async (featureData: SelectedFeatureDisplayData, pageX: number, pageY: number) => {
    setIsFetchingDescription(true);
    setAiDescription(null); // Clear previous AI description

    let finalDescription = featureData.originalDescription || `Explore ${featureData.name}, a notable area in Nepal.`; // Fallback

    if (featureData.type === 'District' && featureData.name) {
      try {
        console.log(`HomepageMap: Requesting AI description for district: ${featureData.name}`);
        const result = await getDistrictDescription({ districtName: featureData.name });
        if (result && result.description) {
          finalDescription = result.description;
          setAiDescription(result.description); // Store AI description separately if needed elsewhere
        } else {
          console.warn(`AI description for ${featureData.name} was empty or undefined.`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown AI description error";
        console.error(`HomepageMap: Error generating AI description for ${featureData.name}:`, errorMsg);
        toast({
          title: "AI Description Error",
          description: `Could not load AI insights for ${featureData.name}.`,
          variant: "default",
        });
      }
    }
    
    setSelectedFeatureInfo({
      feature: { ...featureData, description: finalDescription }, // Update with AI or original/fallback
      pageX,
      pageY,
    });
    setIsFetchingDescription(false);
  }, [toast]);


  const handleFeatureClick = useCallback((
    featureProps: any,
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGElement | SVGGElement>
  ) => {
    event.stopPropagation();
    const localDisplayName = featureProps?.name || "Unknown Area";
    const localFeatureId = String(featureProps?.id || featureProps?.rsmKey || localDisplayName + Math.random());
    
    console.log(`${featureType} Clicked:`, localDisplayName, "Event clientX:", event.clientX, "clientY:", event.clientY, "Feature ID:", localFeatureId);
    
    const baseFeatureData: SelectedFeatureDisplayData = {
      id: localFeatureId,
      name: localDisplayName,
      type: featureType,
      population: featureProps?.population,
      originalDescription: featureProps?.description, // Store original description
      description: featureProps?.description || `Explore ${localDisplayName}, a diverse area in Nepal.`, // Initial description
      link: featureProps?.link || `/districts?name=${encodeURIComponent(localDisplayName)}`,
      properties: featureProps,
    };

    // Set temporary info while AI description fetches
    setSelectedFeatureInfo({
      feature: baseFeatureData,
      pageX: event.clientX,
      pageY: event.clientY,
    });

    if (featureType === 'District') {
      fetchAiDescriptionAndUpdateState(baseFeatureData, event.clientX, event.clientY);
    } else {
        // For cities, we don't fetch AI description, use original description directly
        setIsFetchingDescription(false);
        setAiDescription(null);
    }

  }, [fetchAiDescriptionAndUpdateState]);


  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    setAiDescription(null);
    setIsFetchingDescription(false);
  }, []);

  useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo state updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);

  let displayErrorMessage = fetchError;
  if (!fetchError && !isLoadingMapGeometry && !mapData) {
    displayErrorMessage = `Map data is not available or is empty. Please check the data source: ${NEPAL_GEO_URL}. Also verify your TopoJSON structure and the '${TOPOJSON_OBJECT_KEY}' layer.`;
  } else if (!fetchError && !isLoadingMapGeometry && mapData && mapData.length === 0) {
     displayErrorMessage = `Map data from ${NEPAL_GEO_URL} (layer '${TOPOJSON_OBJECT_KEY}') was processed but resulted in an empty feature set. Ensure the TopoJSON layer contains geometries.`;
  }


  if (isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full h-full bg-muted/30 rounded-xl flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Initializing Interactive Map...</p>
      </div>
    );
  }
  
  if (displayErrorMessage || !mapData) { // Check mapData directly
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full h-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">{displayErrorMessage}</p>
      </div>
    );
  }
  
  return (
    <div
      ref={mapContainerRef}
      className="relative w-full h-full bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={handleCloseInfoBox}
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
                const properties = geo.properties as ProvinceMapData; // Assuming ProvinceMapData holds what we need
                const districtName = properties?.name || "Unknown District";
                const geoId = String(geo.id || geo.rsmKey || properties?.id || districtName + Math.random());
                const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === 'District';
                
                return (
                  <Geography
                    key={geoId} 
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => {
                        handleFeatureClick(properties, 'District', event);
                    }}
                    className={cn(
                      "outline-none transition-all duration-150 ease-out cursor-pointer",
                      isSelected
                        ? 'fill-accent stroke-accent-foreground stroke-[1.5px]'
                        : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30'
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
                // @ts-ignore
                const centroid = geo.centroid as [number, number] | undefined;

                if (!centroid || !districtName ) return null;
                
                let fontSize = 5;
                if (["Kathmandu", "Kaski", "Morang", "Rupandehi"].includes(districtName)) fontSize = 6;
                if (districtName === "Kathmandu") fontSize = 7;


                return (
                  <Marker key={`label-${geo.id || geo.rsmKey}`} coordinates={centroid}>
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
            let labelFontSize = 5;
            if (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") {
                labelFontSize = city.name === "Kathmandu" ? 7 : 6;
            }
             if (city.name === "Biratnagar" || city.name === "Nepalgunj" || city.name === "Janakpur") {
                labelFontSize = 5;
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
                "fixed p-0 w-60 sm:w-72 md:w-80 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[1000] transition-all duration-200 ease-out",
                "transform-gpu" 
            )}
            style={{
                left: `${Math.min(selectedFeatureInfo.pageX + 15, window.innerWidth - (mapContainerRef.current.offsetWidth > 768 ? 320 : (mapContainerRef.current.offsetWidth > 640 ? 288 : 256)) - 15 )}px`,
                top: `${Math.min(selectedFeatureInfo.pageY + 15, window.innerHeight - 200 - 15 )}px`,
                transform: selectedFeatureInfo.pageX + 15 + (mapContainerRef.current.offsetWidth > 768 ? 320 : (mapContainerRef.current.offsetWidth > 640 ? 288 : 256)) > window.innerWidth ? 'translateX(calc(-100% - 30px))' : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} 
          >
            <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-base md:text-lg font-bold leading-tight flex items-center text-primary">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                     {selectedFeatureInfo.feature.type && <CardDescription className="text-xs pt-0.5 pl-[1.375rem]">{selectedFeatureInfo.feature.type}</CardDescription>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleCloseInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-3 text-xs md:text-sm max-h-32 overflow-y-auto space-y-1">
                {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <div className="flex items-center text-muted-foreground my-1">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading description...
                    </div>
                )}
                {!isFetchingDescription && selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground line-clamp-3">{selectedFeatureInfo.feature.description}</p>
                )}
                {!isFetchingDescription && !selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground italic line-clamp-3">Explore {selectedFeatureInfo.feature.name}, a notable area in Nepal.</p>
                )}
                 {selectedFeatureInfo.feature.population && (
                    <p className="text-muted-foreground/80 mt-1.5 text-[10px]">Population: {selectedFeatureInfo.feature.population.toLocaleString()}</p>
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
