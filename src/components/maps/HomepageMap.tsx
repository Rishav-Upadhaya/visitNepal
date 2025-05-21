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
// Removed Firebase db import as per previous request to remove Firebase parts for map data
// import { db } from '@/lib/firebase';
// import { collection, getDocs, type DocumentData } from 'firebase/firestore';


const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal";

interface SelectedFeatureInfo {
  feature: ExtendedProperties;
  clientX: number; // Use clientX for viewport-relative positioning
  clientY: number; // Use clientY
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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setMapData(null);

      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`);
        }
        const rawMapData: Topology = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON fetched successfully. Keys in objects:", rawMapData.objects ? Object.keys(rawMapData.objects) : "rawMapData.objects is null/undefined");

        if (rawMapData && typeof rawMapData.objects === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          // @ts-ignore
          if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
            const geoJsonFeatures = topojsonFeature(rawMapData, layer!).features as ExtendedFeature[];
            
            if (geoJsonFeatures && geoJsonFeatures.length > 0) {
              setMapData(geoJsonFeatures.map(f => ({
                ...f,
                properties: {
                  ...f.properties,
                  id: String(f.id || (f.properties as any)?.id || (f.properties as any)?.DIST_EN || (f.properties as any)?.name || Math.random().toString(36).substring(7)),
                  name: (f.properties as any)?.name || (f.properties as any)?.DIST_EN || (f.properties as any)?.PROV_EN || "Unknown District",
                  type: 'District',
                  description: (f.properties as any)?.description || `Explore this district of Nepal.`,
                  link: (f.properties as any)?.link || `/districts?name=${encodeURIComponent((f.properties as any)?.name || (f.properties as any)?.DIST_EN || '')}`
                }
              })));
            } else {
              const errorMsg = `Failed to extract or convert valid geometries from TopoJSON layer '${TOPOJSON_OBJECT_KEY}' in ${NEPAL_GEO_URL}. Layer might be empty. Layer content: ${JSON.stringify(layer).substring(0,200)}...`;
              console.error("HomepageMap:", errorMsg);
              setFetchError(errorMsg);
            }
          } else {
            const errorMsg = `Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Layer '${TOPOJSON_OBJECT_KEY}' is not a GeometryCollection or missing 'geometries'. Layer content: ${JSON.stringify(layer).substring(0,200)}...`;
            console.error("HomepageMap:", errorMsg);
            setFetchError(errorMsg);
          }
        } else {
          const errorMsg = `Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
        }
      } catch (err) {
        let specificError = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        console.error("HomepageMap: fetchData error:", specificError, err);
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchData();
  }, []);


  const generateAndSetDescription = useCallback(async (featureName: string, featureType: 'District' | 'City') => {
    if (featureType !== 'District' || !featureName) {
      setAiDescription(null);
      setIsFetchingDescription(false);
      return;
    }
    setIsFetchingDescription(true);
    setAiDescription(null);
    try {
      const result = await getDistrictDescription({ districtName: featureName });
      if (result && result.description) {
        setAiDescription(result.description);
      } else {
        setAiDescription(`Explore ${featureName}, a diverse district in Nepal.`);
      }
    } catch (error) {
      console.error(`Error generating AI description for ${featureName}:`, error);
      toast({
        title: "AI Description Error",
        description: `Could not fetch AI insights for ${featureName}.`,
        variant: "default",
      });
      setAiDescription(null);
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedFeatureInfo?.feature.type === 'District' && selectedFeatureInfo.feature.name) {
      generateAndSetDescription(selectedFeatureInfo.feature.name, 'District');
    } else {
      setAiDescription(null);
      setIsFetchingDescription(false);
    }
  }, [selectedFeatureInfo, generateAndSetDescription]);

  const handleFeatureClick = useCallback((
    featureProps: any,
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGGElement>
  ) => {
    event.stopPropagation();

    const localDisplayName = featureProps?.name || (featureType === 'District' ? "Unknown District" : "Unknown City");
    const localFeatureId = String(featureProps?.id || featureProps?.rsmKey || localDisplayName + Math.random());
    
    const defaultDescription = featureProps?.description || `Explore ${localDisplayName}, a notable area in Nepal.`;
    const defaultLink = featureProps?.link || `/districts?name=${encodeURIComponent(localDisplayName)}`;

    const newSelectedFeature: ExtendedProperties = {
      id: localFeatureId,
      name: localDisplayName,
      type: featureType,
      description: defaultDescription,
      population: featureProps?.population,
      link: defaultLink,
      properties: featureType === 'District' ? featureProps : undefined,
    };
    
    console.log(`${featureType} Clicked:`, localDisplayName, "Event clientX:", event.clientX, "clientY:", event.clientY, "Feature Data:", newSelectedFeature);

    setSelectedFeatureInfo({
      feature: newSelectedFeature,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, []);
  
  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);
  
  useEffect(() => {
    if (selectedFeatureInfo) {
      const { clientX, clientY } = selectedFeatureInfo;
      let left = clientX + 15; // Use clientX
      let top = clientY + 15;  // Use clientY

      // More robust dimensions, considering Tailwind classes
      const boxWidth = mapContainerRef.current?.querySelector('.info-box-card')?.clientWidth || 240; // w-60 default
      const boxHeight = mapContainerRef.current?.querySelector('.info-box-card')?.clientHeight || 200; // Approximate

      if (left + boxWidth > window.innerWidth - 15) {
        left = clientX - boxWidth - 15;
      }
      if (top + boxHeight > window.innerHeight - 15) {
        top = clientY - boxHeight - 15;
      }
      if (top < 15) top = 15;
      if (left < 15) left = 15;

      setInfoBoxStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        visibility: 'visible',
        zIndex: 50,
      });
    } else {
      setInfoBoxStyle({ display: 'none' });
    }
  }, [selectedFeatureInfo]);

  let displayErrorMessage = fetchError;
   if (!fetchError && !isLoadingMapGeometry && !mapData) {
     displayErrorMessage = `Map data file (${NEPAL_GEO_URL}) could not be loaded or is empty. Please ensure it exists in 'public/data/' and is a valid TopoJSON.`;
   } else if (mapData && mapData.length === 0 && !isLoadingMapGeometry && !fetchError) {
     displayErrorMessage = `Map data from ${NEPAL_GEO_URL} (layer '${TOPOJSON_OBJECT_KEY}') resulted in an empty feature set. Please check the TopoJSON file content and layer name.`;
   }


  if (displayErrorMessage && !isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">{displayErrorMessage}</p>
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
      onClick={() => { if(selectedFeatureInfo) handleCloseInfoBox(); }} // Click on map background closes info box only if one is open
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 4000,
          center: [84.1240, 28.3949]
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing districts and key cities"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
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
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedProperties;
                const districtName = properties?.name || "Unknown District";
                // @ts-ignore 
                const centroid = (geo as any).centroid as [number, number] | undefined;

                if (!centroid || !districtName) return null;
                
                let fontSize = 4;
                if (["Kathmandu", "Kaski", "Morang", "Rupandehi", "Pokhara", "Lumbini"].includes(districtName)) fontSize = 5;
                if (districtName === "Kathmandu" || districtName === "Pokhara" || districtName === "Lumbini") fontSize = 6;


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
            let labelFontSize = 5;
             if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) labelFontSize = 6;
            
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

      {selectedFeatureInfo && (
        <Card
            className="info-box-card fixed p-0 w-56 sm:w-60 md:w-64 shadow-2xl border border-border bg-card text-card-foreground rounded-lg transition-all duration-200 ease-out text-xs"
            style={infoBoxStyle}
            onClick={(e) => e.stopPropagation()} 
        >
            <CardHeader className="flex flex-row items-start justify-between p-2.5 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-base md:text-lg font-bold leading-tight flex items-center text-primary">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleCloseInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-2.5 text-xs md:text-sm max-h-[7rem] sm:max-h-32 overflow-y-auto space-y-1.5">
                 {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <div className="flex items-center text-muted-foreground my-1 text-[10px] md:text-xs">
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Loading details...
                    </div>
                )}
                {!isFetchingDescription && aiDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <p className="text-muted-foreground line-clamp-4">{aiDescription}</p>
                )}
                 {!isFetchingDescription && !aiDescription && selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground line-clamp-4">{selectedFeatureInfo.feature.description}</p>
                )}
                {!isFetchingDescription && !aiDescription && !selectedFeatureInfo.feature.description && selectedFeatureInfo.feature.type === 'District' && (
                     <p className="text-muted-foreground italic line-clamp-4">Explore {selectedFeatureInfo.feature.name}, a notable district in Nepal.</p>
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
    </div>
  );
}

