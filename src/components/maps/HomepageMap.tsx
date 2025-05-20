
// src/components/maps/HomepageMap.tsx
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
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
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // Key for the layer in TopoJSON

interface SelectedFeatureDetails {
  id: string;
  name: string;
  type: 'District' | 'City';
  description?: string;
  population?: number;
  link?: string;
  properties?: any; // Raw properties from GeoJSON/TopoJSON if needed
}

interface SelectedFeatureState {
  feature: SelectedFeatureDetails;
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null); // Stores array of GeoJSON features
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureState | null>(null);
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

  const [provinceDetails, setProvinceDetails] = useState<Record<string, Partial<ProvinceMapData>>>({});
  const [cityDetails, setCityDetails] = useState<Record<string, Partial<CityMapData>>>({});

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setMapData(null);

      // Fetch TopoJSON for map shapes
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`);
        }
        const rawMapData: Topology = await geoRes.json();

        if (rawMapData && typeof rawMapData.objects === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          if (layer && typeof layer === 'object' && 'geometries' in layer && Array.isArray(layer.geometries)) {
            // @ts-ignore // topojson-client types can be complex
            const geoJsonFeatures = topojsonFeature(rawMapData, layer).features as ExtendedFeature[];
            
            if (geoJsonFeatures && geoJsonFeatures.length > 0) {
              setMapData(geoJsonFeatures.map(f => ({
                ...f,
                properties: {
                  ...f.properties,
                  id: String(f.id || (f.properties as any)?.id || (f.properties as any)?.DIST_EN || (f.properties as any)?.name || Math.random().toString(36).substring(7)),
                  name: (f.properties as any)?.name || (f.properties as any)?.DIST_EN || (f.properties as any)?.PROV_EN || "Unknown District",
                  type: 'District', // Set type explicitly for these features
                  description: (f.properties as any)?.description || `Explore this district of Nepal.`,
                  link: (f.properties as any)?.link || `/districts?name=${encodeURIComponent((f.properties as any)?.name || (f.properties as any)?.DIST_EN || '')}`
                }
              })));
            } else {
              const errorMsg = `Failed to extract or convert valid geometries from TopoJSON layer '${TOPOJSON_OBJECT_KEY}' in ${NEPAL_GEO_URL}. The layer might be empty or malformed.`;
              console.error("HomepageMap:", errorMsg, "Layer:", layer);
              throw new Error(errorMsg);
            }
          } else {
            const errorMsg = `Invalid TopoJSON structure: Layer '${TOPOJSON_OBJECT_KEY}' is not a GeometryCollection or missing 'geometries'. Layer content: ${JSON.stringify(layer).substring(0,200)}...`;
            console.error("HomepageMap:", errorMsg);
            throw new Error(errorMsg);
          }
        } else {
          const errorMsg = `Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
      } catch (err) {
        let specificError = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        if (specificError.includes("offline") || specificError.includes("Failed to get document")) {
            specificError = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${specificError}`;
        }
        console.error("HomepageMap: fetchData error:", specificError, err);
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchData();
  }, []);

  const generateAndSetDescription = useCallback(async (featureName: string, featureId: string) => {
    if (selectedFeatureInfo && selectedFeatureInfo.feature.id === featureId && selectedFeatureInfo.feature.type === 'District') {
        setIsFetchingDescription(true);
        setAiDescription(null);
        try {
            const result = await getDistrictDescription({ districtName: featureName });
            if (result && result.description) {
                setAiDescription(result.description);
            } else {
                setAiDescription(`Learn more about ${featureName}, a unique district in Nepal.`);
            }
        } catch (error) {
            console.error(`Error generating AI description for ${featureName}:`, error);
            toast({
                title: "AI Description Error",
                description: `Could not fetch AI insights for ${featureName}. Displaying default information.`,
                variant: "default",
            });
            setAiDescription(null); // Fallback to default or properties description
        } finally {
            setIsFetchingDescription(false);
        }
    }
  }, [selectedFeatureInfo, toast]);


  useEffect(() => {
    if (selectedFeatureInfo?.feature.type === 'District' && selectedFeatureInfo.feature.name) {
      generateAndSetDescription(selectedFeatureInfo.feature.name, selectedFeatureInfo.feature.id);
    } else {
      // Clear AI description if a city is selected or info box is closed
      setAiDescription(null);
      setIsFetchingDescription(false);
    }
  }, [selectedFeatureInfo, generateAndSetDescription]);


  const handleFeatureClick = useCallback((
    featureProps: any,
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGElement | SVGGElement>
  ) => {
    event.stopPropagation();
    const localDisplayName = featureProps?.name || (featureType === 'District' ? "Unknown District" : "Unknown City");
    const localFeatureId = String(featureProps?.id || featureProps?.rsmKey || localDisplayName + Math.random());

    const defaultDescription = featureProps?.description || `Explore ${localDisplayName}, a notable area in Nepal.`;
    const defaultLink = featureProps?.link || `/districts?name=${encodeURIComponent(localDisplayName)}`;

    const newSelectedFeature: SelectedFeatureDetails = {
      id: localFeatureId,
      name: localDisplayName,
      type: featureType,
      description: defaultDescription,
      population: featureProps?.population,
      link: defaultLink,
      properties: featureType === 'District' ? featureProps : undefined,
    };
    
    setSelectedFeatureInfo({
      feature: newSelectedFeature,
      pageX: event.clientX,
      pageY: event.clientY,
    });
  }, []);


  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);

  let displayErrorMessage = fetchError;
  if (!fetchError && !isLoadingMapGeometry && !mapData) {
    displayErrorMessage = `Map data (${NEPAL_GEO_URL}) could not be loaded or is empty. Ensure the file exists, is valid, and the TOPOJSON_OBJECT_KEY ('${TOPOJSON_OBJECT_KEY}') is correct.`;
  } else if (!fetchError && !isLoadingMapGeometry && mapData && mapData.length === 0) {
     displayErrorMessage = `Map data from ${NEPAL_GEO_URL} (layer '${TOPOJSON_OBJECT_KEY}') was processed but resulted in an empty feature set. Ensure the TopoJSON layer contains geometries.`;
  }

  if (displayErrorMessage) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">{displayErrorMessage}</p>
        <p className="text-xs mt-2">Please check console for details and ensure your Firebase config & map data files are correct.</p>
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
      onClick={handleCloseInfoBox} // Click on map background closes info box
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
            geography={mapData} // mapData is now an array of GeoJSON features
          >
            {({ geographies }) =>
              geographies.map(geo => {
                const districtProperties = geo.properties as SelectedFeatureDetails; // Assuming properties match this structure
                const displayName = districtProperties?.name || "Unknown District";
                const geoId = districtProperties?.id || geo.rsmKey || displayName + Math.random();
                
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
                    aria-label={displayName}
                  />
                );
              })
            }
          </Geographies>
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as SelectedFeatureDetails;
                const districtName = properties?.name || "Unknown District";
                const centroid = (geo as any).centroid as [number, number] | undefined;

                if (!centroid || !districtName) return null;
                
                let fontSize = 4;
                if (["Kathmandu", "Kaski", "Morang", "Rupandehi", "Pokhara", "Lumbini"].includes(districtName)) fontSize = 5;
                if (districtName === "Kathmandu") fontSize = 6;
                if (districtName === "Pokhara") fontSize = 5.5; // Slightly larger for Pokhara
                if (districtName === "Lumbini") fontSize = 5.5; // Slightly larger for Lumbini


                return (
                  <Marker key={`label-${geo.rsmKey || properties.id}`} coordinates={centroid}>
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
          {majorCities.map((city) => {
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo?.feature.type === 'City';
            let labelFontSize = 4;
            if (city.name === "Kathmandu") labelFontSize = 7;
            else if (city.name === "Pokhara" || city.name === "Lumbini") labelFontSize = 6;
            else if (["Biratnagar", "Nepalgunj", "Janakpur"].includes(city.name)) labelFontSize = 5;


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
                    r={isSelected ? 4 : 3} 
                    className={cn(
                      isSelected ? 'fill-accent stroke-accent-foreground' : 'fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground'
                    )}
                    strokeWidth={0.5}
                  />
                  <text
                    textAnchor="middle"
                    y={isSelected ? -7 : -6} 
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

      {selectedFeatureInfo && mapContainerRef.current && (
          <Card
            className={cn(
                "fixed p-0 w-56 sm:w-60 md:w-64 shadow-xl border border-border bg-card text-card-foreground rounded-lg z-[1000] transition-all duration-200 ease-out text-xs",
                // Removed debug styles: "border-4 border-yellow-500 bg-pink-500 text-white font-bold z-[99999]"
            )}
            style={{
                left: `${Math.min(selectedFeatureInfo.pageX + 15, window.innerWidth - (mapContainerRef.current?.offsetWidth > 768 ? 256 : (mapContainerRef.current?.offsetWidth > 640 ? 240 : 224)) - 15 )}px`,
                top: `${Math.min(selectedFeatureInfo.pageY + 15, window.innerHeight - 180 - 15 )}px`, // Adjusted max height to fit content
                transform: selectedFeatureInfo.pageX + 15 + (mapContainerRef.current?.offsetWidth > 768 ? 256 : (mapContainerRef.current?.offsetWidth > 640 ? 240 : 224)) > window.innerWidth ? 'translateX(calc(-100% - 30px))' : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} 
          >
            <CardHeader className="flex flex-row items-start justify-between p-2.5 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-sm md:text-base font-bold leading-tight flex items-center text-primary">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleCloseInfoBox} aria-label="Close info box">
                    <XIcon className="w-3.5 h-3.5" />
                </Button>
            </CardHeader>
            <CardContent className="p-2.5 text-xs md:text-sm max-h-24 overflow-y-auto space-y-1">
                {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <div className="flex items-center text-muted-foreground my-1 text-[10px] md:text-xs">
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Loading description...
                    </div>
                )}
                {!isFetchingDescription && aiDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <p className="text-muted-foreground line-clamp-3">{aiDescription}</p>
                )}
                 {!isFetchingDescription && !aiDescription && selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground line-clamp-3">{selectedFeatureInfo.feature.description}</p>
                )}
                {!isFetchingDescription && !aiDescription && !selectedFeatureInfo.feature.description && selectedFeatureInfo.feature.type === 'District' && (
                     <p className="text-muted-foreground italic line-clamp-3">Explore {selectedFeatureInfo.feature.name}, a notable district in Nepal.</p>
                )}
                {selectedFeatureInfo.feature.population && (
                    <p className="text-muted-foreground/80 mt-1 text-[10px] md:text-xs">Population: {selectedFeatureInfo.feature.population.toLocaleString()}</p>
                )}
            </CardContent>
            {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-2.5 border-t pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs md:text-sm text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
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
    {isFetchingDescription && !isLoadingMapGeometry && selectedFeatureInfo?.feature.type === 'District' && (
        <div className="absolute bottom-2 right-2 p-1.5 bg-muted/80 text-muted-foreground text-[10px] rounded-md flex items-center gap-1.5 z-50">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
