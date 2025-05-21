
// src/components/maps/HomepageMap.tsx
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData, ExtendedProperties } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology } from 'topojson-client';
import { getDistrictDescription } from '@/ai/flows/get-district-description-flow';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Using TopoJSON
const TOPOJSON_OBJECT_KEY = "nepal"; // The key in TopoJSON objects that holds the geometry collection

interface SelectedFeatureInfo {
  feature: ExtendedProperties;
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureInfo | null>(null);
  const [infoBoxStyle, setInfoBoxStyle] = useState<React.CSSProperties>({ display: 'none' });
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const majorCities: CityMapData[] = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', description: "The vibrant capital, rich in culture and ancient temples.", population: 1442271, link: '/districts?name=Kathmandu', highlight: true },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', description: "A picturesque city by Phewa Lake with stunning Himalayan views.", population: 400000, link: '/districts?name=Kaski', highlight: true },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', description: "The sacred birthplace of Lord Buddha, a UNESCO World Heritage site.", population: 70000, link: '/districts?name=Rupandehi', highlight: true },
    { id: 'biratnagar', name: 'Biratnagar', coordinates: [87.2798, 26.4525], type: 'City', description: "Major industrial city and hub in Eastern Nepal.", population: 242548, link: '/districts?name=Morang', highlight: true },
    { id: 'nepalgunj', name: 'Nepalgunj', coordinates: [81.6167, 28.0500], type: 'City', description: "Key transport and trade hub in Western Nepal, near Indian border.", population: 138951, link: '/districts?name=Banke', highlight: true },
    { id: 'janakpur', name: 'Janakpur', coordinates: [85.9228, 26.7285], type: 'City', description: "Historic city, religious center, and birthplace of Goddess Sita.", population: 195438, link: '/districts?name=Dhanusha', highlight: true },
  ];

  const fetchData = useCallback(async () => {
    setIsLoadingMapGeometry(true);
    setFetchError(null);
    setMapData(null);
    console.log("HomepageMap: Starting to fetch map data from:", NEPAL_GEO_URL);

    try {
      const geoRes = await fetch(NEPAL_GEO_URL);
      if (!geoRes.ok) {
        const errorText = await geoRes.text();
        throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0,200)}...`);
      }
      const rawMapData: Topology = await geoRes.json();
      console.log("HomepageMap: Raw TopoJSON fetched successfully. Objects keys:", Object.keys(rawMapData.objects || {}));

      if (rawMapData && typeof rawMapData.objects === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
        const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
        // @ts-ignore
        if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
          const geoJsonFeatures = topojsonFeature(rawMapData, layer!).features as ExtendedFeature[];
           if (geoJsonFeatures && geoJsonFeatures.length > 0) {
            setMapData(geoJsonFeatures.map(f => ({
              ...f,
              id: String(f.id || (f.properties as any)?.id || (f.properties as any)?.ADM1_EN || (f.properties as any)?.DIST_EN || (f.properties as any)?.name || Math.random().toString(36).substring(7)),
              properties: {
                ...f.properties,
                id: String(f.id || (f.properties as any)?.id || (f.properties as any)?.ADM1_EN || (f.properties as any)?.DIST_EN || (f.properties as any)?.name || Math.random().toString(36).substring(7)),
                name: (f.properties as any)?.name || (f.properties as any)?.ADM1_EN || (f.properties as any)?.DIST_EN || "Unknown District",
                type: 'District',
                description: (f.properties as any)?.description || `Explore this district of Nepal.`,
                link: (f.properties as any)?.link || `/districts?name=${encodeURIComponent((f.properties as any)?.name || (f.properties as any)?.ADM1_EN || (f.properties as any)?.DIST_EN || '')}`
              }
            })));
          } else {
            const errorMsg = `Failed to extract or convert valid geometries from TopoJSON layer '${TOPOJSON_OBJECT_KEY}' in ${NEPAL_GEO_URL}. The layer might be empty or malformed.`;
            console.error("HomepageMap:", errorMsg, "Layer:", layer);
            setFetchError(errorMsg);
            setMapData(null);
          }
        } else {
          const errorMsg = `Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Layer '${TOPOJSON_OBJECT_KEY}' is not a GeometryCollection or missing 'geometries'. Layer content: ${JSON.stringify(layer).substring(0,200)}...`;
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
      let specificError = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
      if (specificError.includes("offline") || specificError.includes("Failed to get document")) {
          specificError = "Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: " + specificError;
      } else if (specificError.includes("NetworkError") || specificError.includes("fetch map data")){
          specificError = `Network Error: Could not fetch map data from ${NEPAL_GEO_URL}. Please check your internet connection and the file path.`;
      }
      console.error("HomepageMap: fetchData error:", specificError, err);
      setFetchError(specificError);
      setMapData(null);
    } finally {
      setIsLoadingMapGeometry(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const generateAIDescription = useCallback(async (featureName: string, featureType: 'District' | 'City') => {
    if (featureType !== 'District' || !featureName) {
      setAiDescription(null);
      setIsFetchingDescription(false);
      return;
    }
    setIsFetchingDescription(true);
    setAiDescription(null); // Clear previous AI description
    try {
      console.log(`HomepageMap: Fetching AI description for district: ${featureName}`);
      const result = await getDistrictDescription({ districtName: featureName });
      if (result && result.description) {
        setAiDescription(result.description);
        console.log(`HomepageMap: AI description for ${featureName}: ${result.description}`);
      } else {
        setAiDescription(`Explore ${featureName}, a notable district in Nepal.`); // Fallback
      }
    } catch (error) {
      console.error(`HomepageMap: Error generating AI description for ${featureName}:`, error);
      toast({
        title: "AI Description Error",
        description: `Could not fetch AI insights for ${featureName}. Using default description.`,
        variant: "default",
      });
      setAiDescription(null); // Keep it null or set a fallback
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedFeatureInfo?.feature.type === 'District' && selectedFeatureInfo.feature.name) {
      generateAIDescription(selectedFeatureInfo.feature.name, 'District');
    } else {
      setAiDescription(null); // Clear AI description if no district or a city is selected
      setIsFetchingDescription(false);
    }
  }, [selectedFeatureInfo, generateAIDescription]);


  const handleFeatureClick = useCallback((
    featureProps: any,
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGGElement>
  ) => {
    event.stopPropagation();

    const districtName = featureProps?.name || (featureType === 'District' ? (featureProps?.ADM1_EN || featureProps?.DIST_EN || "Unknown District") : "Unknown City");
    const featureId = String(featureProps?.id || featureProps?.rsmKey || districtName + Math.random());
    
    console.log(`${featureType} Clicked:`, districtName, "Event clientX:", event.clientX, "clientY:", event.clientY);

    const featureData: ExtendedProperties = {
      id: featureId,
      name: districtName,
      type: featureType,
      population: featureProps?.population, // From majorCities or Firestore for districts
      description: featureProps?.description || `Explore ${districtName}, a diverse place in Nepal.`,
      link: featureProps?.link || `/districts?name=${encodeURIComponent(districtName)}`,
      properties: featureType === 'District' ? featureProps : undefined,
    };

    setSelectedFeatureInfo({
      feature: featureData,
      pageX: event.clientX,
      pageY: event.clientY,
    });
  }, []);

  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);

  useEffect(() => {
    if (selectedFeatureInfo && mapContainerRef.current) {
      const { pageX, pageY } = selectedFeatureInfo;
      const mapRect = mapContainerRef.current.getBoundingClientRect();
      const infoBoxWidth = 256; // approx w-64 in Tailwind
      const infoBoxHeight = 200; // approx height

      let newLeft = pageX + 15;
      let newTop = pageY + 15;
      let transform = '';

      // Adjust if too close to right edge of map container (relative to viewport)
      if (pageX + infoBoxWidth + 15 > mapRect.right) {
        newLeft = pageX - 15; // position to the left of cursor
        transform = 'translateX(-100%)';
      }

      // Adjust if too close to bottom edge of map container (relative to viewport)
      if (pageY + infoBoxHeight + 15 > mapRect.bottom) {
        newTop = pageY - 15; // position above cursor
        transform += ' translateY(-100%)';
      }
      
      // Ensure it doesn't go off the top or left of the map container
      if (newTop < mapRect.top + 5) newTop = mapRect.top + 5;
      if (newLeft < mapRect.left + 5 && !transform.includes('translateX(-100%)')) newLeft = mapRect.left + 5;
      if (newLeft - infoBoxWidth < mapRect.left + 5 && transform.includes('translateX(-100%)')) newLeft = mapRect.left + 5 + infoBoxWidth;


      setInfoBoxStyle({
        position: 'fixed',
        left: `${newLeft}px`,
        top: `${newTop}px`,
        transform: transform.trim(),
        visibility: 'visible',
        zIndex: 50,
        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
      });
    } else {
      setInfoBoxStyle({ display: 'none', visibility: 'hidden' });
    }
  }, [selectedFeatureInfo]);


  let displayErrorMessage = fetchError;
  if (!fetchError && !isLoadingMapGeometry && !mapData) {
    displayErrorMessage = `Map data file (${NEPAL_GEO_URL}) could not be loaded or is empty. Please ensure it exists in '/public/data/' and is a valid, non-empty TopoJSON file with a layer named '${TOPOJSON_OBJECT_KEY}'.`;
  }
  
  if (displayErrorMessage || (!mapData && !isLoadingMapGeometry)) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">{displayErrorMessage || "An unexpected error occurred while loading map data."}</p>
      </div>
    );
  }

  if (isLoadingMapGeometry || !mapData) {
    return (
      <div className="aspect-[16/9] w-full h-full bg-muted/30 rounded-xl flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Initializing Interactive Map...</p>
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
          scale: 4000, // Increased scale
          center: [84.1240, 28.3949]
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing districts and key cities"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
          {/* Geographies for Provinces/Districts */}
          <Geographies 
            geography={mapData} 
          >
            {({ geographies }) =>
              geographies.map(geo => {
                const districtProperties = geo.properties as ExtendedProperties;
                const districtName = districtProperties?.name || "Unknown District";
                const geoId = String(geo.rsmKey || districtProperties?.id || districtName + Math.random());
                
                const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === 'District';
                
                return (
                  <Geography
                    key={geoId} 
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => {
                        handleFeatureClick(districtProperties, 'District', event);
                    }}
                    className={cn(
                      "outline-none transition-all duration-150 ease-out cursor-pointer",
                      isSelected
                        ? 'fill-accent stroke-accent-foreground stroke-[1.5px] opacity-100' 
                        : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] opacity-70 hover:opacity-100 hover:fill-accent/40 dark:hover:fill-accent/30'
                    )}
                    aria-label={districtName}
                  />
                );
              })
            }
          </Geographies>
          {/* Geographies for Labels (optional, if needed for better label placement or styling) */}
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedProperties;
                const districtName = properties?.name || "Unknown District";
                const geoId = String(geo.rsmKey || properties?.id || districtName + Math.random() + "_label");
                // @ts-ignore
                const centroid = (geo as any).centroid as [number, number] | undefined;

                if (!centroid || !districtName) return null;
                
                let fontSize = 4;
                if (["Kathmandu", "Kaski", "Morang", "Rupandehi", "Pokhara", "Lumbini"].includes(districtName)) fontSize = 5;
                 if (["Kathmandu", "Pokhara", "Lumbini"].includes(districtName)) fontSize = 7;


                return (
                  <Marker key={geoId} coordinates={centroid}>
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
          {/* Major Cities Markers */}
          {majorCities.map((city) => {
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo?.feature.type === 'City';
            let labelFontSize = 5;
            if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) labelFontSize = 7;
            
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
                    r={isSelected ? 6 : 5} 
                    className={cn(
                      isSelected ? 'fill-accent stroke-accent-foreground' : 'fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground'
                    )}
                    strokeWidth={0.75}
                  />
                  <text
                    textAnchor="middle"
                    y={isSelected ? -9 : -8} 
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
        </ZoomableGroup>
      </ComposableMap>

      {/* Info Box Card */}
      {selectedFeatureInfo && (
        <Card
            className="fixed p-0 w-56 sm:w-60 md:w-64 shadow-xl border border-border bg-card text-card-foreground rounded-lg transition-all duration-200 ease-out text-xs"
            style={infoBoxStyle}
            onClick={(e) => e.stopPropagation()} 
        >
            <CardHeader className="flex flex-row items-start justify-between p-2.5 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-sm md:text-base font-bold leading-tight flex items-center text-primary">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0" onClick={handleCloseInfoBox} aria-label="Close info box">
                    <XIcon className="w-3.5 h-3.5" />
                </Button>
            </CardHeader>
            <CardContent className="p-2.5 text-xs md:text-sm max-h-24 overflow-y-auto space-y-1.5">
                {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
                    <div className="flex items-center text-muted-foreground text-[10px] md:text-xs">
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Loading description...
                    </div>
                )}
                {!isFetchingDescription && aiDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <p className="text-muted-foreground line-clamp-4">{aiDescription}</p>
                )}
                {!isFetchingDescription && !aiDescription && selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground line-clamp-4">{selectedFeatureInfo.feature.description}</p>
                )}
                 {!isFetchingDescription && !aiDescription && !selectedFeatureInfo.feature.description && selectedFeatureInfo.feature.type === 'District' && (
                     <p className="text-muted-foreground italic line-clamp-4">Explore {selectedFeatureInfo.feature.name}, a diverse district in Nepal.</p>
                )}
                {selectedFeatureInfo.feature.population && (
                    <p className="text-muted-foreground/80 mt-1.5 text-[10px] md:text-xs">Population: {selectedFeatureInfo.feature.population.toLocaleString()}</p>
                )}
            </CardContent>
            {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-2.5 border-t pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-[10px] md:text-xs text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
                    onClick={() => {
                        if(selectedFeatureInfo.feature.link) router.push(selectedFeatureInfo.feature.link);
                        handleCloseInfoBox();
                    }}
                >
                    Learn More <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
            </CardFooter>
            )}
        </Card>
    )}
    {/* Loading indicator for AI description (if a district is selected but description is still fetching) */}
    {isFetchingDescription && !isLoadingMapGeometry && (
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-10">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
