
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData, SelectedFeatureDetails, HomepageMapProps, ExtendedProperties } from '@/types';
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

interface InfoBoxStyle {
  left: string;
  top: string;
  visibility: 'visible' | 'hidden';
  transform?: string;
}

export function HomepageMap({ initialMapData: prefetchedMapData }: HomepageMapProps) {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDetails | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, Partial<ProvinceMapData & CityMapData & { aiDescription?: string; isLoadingFirestore?: boolean; isLoadingAI?: boolean }>>>({});
  const [infoBoxStyle, setInfoBoxStyle] = useState<InfoBoxStyle>({ visibility: 'hidden', left: '0px', top: '0px' });
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

  const processRawMapData = useCallback((rawData: Topology | null): { features: ExtendedFeature[] | null, error?: string } => {
    if (!rawData || typeof rawData.objects !== 'object' || rawData.objects === null) {
      const errorMsg = `Invalid TopoJSON structure: 'objects' property is missing or invalid. Ensure ${NEPAL_GEO_URL} is a valid TopoJSON file.`;
      console.error("HomepageMap: processRawMapData -", errorMsg, "Raw Data:", rawData);
      return { features: null, error: errorMsg };
    }
    const layer = rawData.objects[TOPOJSON_OBJECT_KEY];
    if (!layer || typeof layer !== 'object') {
      const errorMsg = `Invalid TopoJSON: Layer '${TOPOJSON_OBJECT_KEY}' not found in objects. Available keys: ${Object.keys(rawData.objects || {}).join(', ')}`;
      console.error("HomepageMap: processRawMapData -", errorMsg, "Raw Data Objects:", rawData.objects);
      return { features: null, error: errorMsg };
    }
    // @ts-ignore
    if (layer.type !== "GeometryCollection" || !Array.isArray(layer.geometries)) {
      const errorMsg = `Invalid TopoJSON: Layer '${TOPOJSON_OBJECT_KEY}' is not a GeometryCollection or has no geometries array. Layer type: ${layer.type}`;
      console.error("HomepageMap: processRawMapData -", errorMsg, "Layer:", layer);
      return { features: null, error: errorMsg };
    }
    // @ts-ignore
    const geoJsonFeatures = topojsonFeature(rawData, layer).features as ExtendedFeature[];

    if (!geoJsonFeatures || geoJsonFeatures.length === 0) {
      const errorMsg = `No features found after processing TopoJSON layer '${TOPOJSON_OBJECT_KEY}'. The layer might be empty.`;
      console.error("HomepageMap: processRawMapData -", errorMsg, "Layer:", layer);
      return { features: null, error: errorMsg };
    }

    return { 
        features: geoJsonFeatures.map((f, index) => {
            const props = f.properties as any; 
            const name = props?.name || props?.DIST_EN || props?.ADM1_EN || `District ${index + 1}`;
            return {
                ...f,
                properties: {
                ...props,
                id: String(f.id || props?.id || name + Math.random()), 
                name: name,
                type: 'District',
                link: `/districts?name=${encodeURIComponent(name)}`,
                description: props?.description || `Explore ${name}, a notable district in Nepal.`
                } as ExtendedProperties,
            };
        })
    };
  }, []);


  useEffect(() => {
    const fetchDataAsync = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setMapData(null);

      let processingResult: { features: ExtendedFeature[] | null, error?: string } = { features: null };

      try {
        if (prefetchedMapData) {
          console.log("HomepageMap: Using prefetched map data.");
          processingResult = processRawMapData(prefetchedMapData);
        } else {
          console.log("HomepageMap: Prefetched map data not available, fetching from URL:", NEPAL_GEO_URL);
          const geoRes = await fetch(NEPAL_GEO_URL);
          if (!geoRes.ok) {
            const errorText = await geoRes.text();
            throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`);
          }
          const rawMapData: Topology = await geoRes.json();
          console.log("HomepageMap: Raw map data fetched. Sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");
          processingResult = processRawMapData(rawMapData);
        }

        if (processingResult.features && processingResult.features.length > 0) {
          setMapData(processingResult.features);
          setFetchError(null); 
        } else {
          const errorMsg = processingResult.error || `No valid map features found or map data is empty after processing ${NEPAL_GEO_URL}.`;
          console.error("HomepageMap: Error after processing -", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        console.error("HomepageMap: Error in fetchDataAsync catch block -", errorMsg, err);
        setFetchError(errorMsg);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchDataAsync();
  }, [prefetchedMapData, processRawMapData]);


  useEffect(() => {
    if (!selectedFeatureInfo?.feature) {
      return;
    }
    const { id: featureId, name: featureName, type: featureType } = selectedFeatureInfo.feature;
    const cached = detailsCache[featureId];
    const shouldFetchAI = featureType === 'District' && (!cached || (!cached.aiDescription && !cached.isLoadingAI && !cached.description));

    if (shouldFetchAI) {
      setDetailsCache(prev => ({
        ...prev,
        [featureId]: { ...prev[featureId], isLoadingAI: true }
      }));
      console.log(`HomepageMap: Fetching AI description for district: ${featureName}`);
      getDistrictDescription({ districtName: featureName })
        .then(result => {
          console.log(`HomepageMap: AI description received for ${featureName}: "${result.description}"`);
          setDetailsCache(prev => ({
            ...prev,
            [featureId]: { ...prev[featureId], aiDescription: result.description, isLoadingAI: false }
          }));
        })
        .catch(err => {
          console.error(`HomepageMap: Error fetching AI description for ${featureName}:`, err);
          toast({
            title: "AI Description Error",
            description: `Could not fetch AI insights for ${featureName}.`,
            variant: "default",
          });
          setDetailsCache(prev => ({
            ...prev,
            [featureId]: { ...prev[featureId], aiDescription: null, isLoadingAI: false }
          }));
        });
    }
  }, [selectedFeatureInfo, toast, detailsCache]);

  const handleFeatureClick = useCallback((
    featureProps: Partial<ExtendedProperties>,
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGGElement>
  ) => {
    event.stopPropagation();
    const localDisplayName = featureProps?.name || (featureType === 'District' ? "Unknown District" : "Unknown City");
    const localFeatureId = String(featureProps?.id || (featureProps as any)?.rsmKey || localDisplayName + Math.random());
    
    console.log(
        `${featureType} Clicked:`, localDisplayName, 
        "Event clientX:", event.clientX, "clientY:", event.clientY, 
        "Feature ID:", localFeatureId, "Full Props:", featureProps
    );
    
    setSelectedFeatureInfo({
      feature: {
        id: localFeatureId,
        name: localDisplayName,
        type: featureType,
        population: featureProps?.population,
        description: featureProps?.description, 
        link: featureProps?.link || (featureType === 'District' ? `/districts?name=${encodeURIComponent(localDisplayName)}` : undefined),
        originalProperties: featureProps, 
      },
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, []);

  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);
  
  const handleMapClick = useCallback(() => {
    if (selectedFeatureInfo) { 
      console.log("HomepageMap: Map background clicked, closing info box.");
      handleCloseInfoBox();
    }
  },[selectedFeatureInfo, handleCloseInfoBox]);

  useEffect(() => {
    if (selectedFeatureInfo && mapContainerRef.current) {
      const { clientX, clientY } = selectedFeatureInfo;
      const infoBoxWidth = 240; 
      const infoBoxHeight = 200; 
      let newLeft = clientX + 15;
      let newTop = clientY + 15;

      if (clientX + infoBoxWidth + 15 > window.innerWidth) {
        newLeft = clientX - infoBoxWidth - 15;
      }
      if (clientY + infoBoxHeight + 15 > window.innerHeight) {
        newTop = clientY - infoBoxHeight - 15; 
      }
      setInfoBoxStyle({ left: `${newLeft}px`, top: `${newTop}px`, visibility: 'visible' });
    } else {
      setInfoBoxStyle(prev => ({ ...prev, visibility: 'hidden' }));
    }
  }, [selectedFeatureInfo]);
  
  let displayErrorMessage = fetchError;
  
  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">
          {displayErrorMessage || "Map data is currently unavailable or could not be processed. Please ensure the map data file is correctly placed and formatted."}
          {(fetchError?.includes("offline") || fetchError?.includes("Failed to get document")) && (
            <span className="block mt-1 text-xs">This might be due to Firebase configuration issues (check `.env.local` or hosting environment variables) or network problems.</span>
          )}
           {(fetchError?.includes("TopoJSON") || fetchError?.includes("features")) && (
            <span className="block mt-1 text-xs">Please ensure '/data/nepal-provinces-topo.json' is a valid TopoJSON file in your /public directory and contains a layer named '{TOPOJSON_OBJECT_KEY}' with a 'geometries' array.</span>
          )}
        </p>
      </div>
    );
  }
  
  if (isLoadingMapGeometry && (!mapData || mapData.length === 0)) { 
    return (
      <div className="aspect-[16/9] w-full h-full bg-transparent rounded-xl flex items-center justify-center">
        <Skeleton className="h-full w-full bg-muted/50" />
        <div className="absolute text-center">
            <Loader2 className="h-8 w-8 md:h-10 md:w-10 text-primary animate-spin mx-auto mb-2" />
            <p className="text-primary font-semibold text-sm md:text-base">Loading Interactive Map of Nepal...</p>
        </div>
      </div>
    );
  }

  const currentSelectedCache = selectedFeatureInfo ? detailsCache[selectedFeatureInfo.feature.id] : null;

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full h-full bg-lime-50 dark:bg-green-900/20 cursor-default"
      onClick={handleMapClick} 
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
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const districtProperties = geo.properties as ExtendedProperties;
                const geoIdForSelection = String(geo.rsmKey || districtProperties.id || districtProperties.name);
                const isSelected =
                  selectedFeatureInfo?.feature.type === 'District' &&
                  selectedFeatureInfo?.feature.id === geoIdForSelection;

                return (
                  <Geography
                    key={geoIdForSelection} 
                    geography={geo}
                    onClick={(event) => handleFeatureClick(districtProperties, 'District', event as unknown as React.MouseEvent<SVGPathElement>)}
                    className={cn(
                        "transition-colors duration-150 ease-in-out outline-none",
                        isSelected 
                          ? "fill-accent stroke-accent-foreground stroke-[1.5px] cursor-default"
                          : "fill-background dark:fill-slate-700 stroke-border dark:stroke-slate-500 stroke-[0.5px] hover:fill-accent/30 dark:hover:fill-accent/40 hover:stroke-accent-foreground cursor-pointer"
                      )}
                    aria-label={districtProperties.name}
                  />
                );
              })
            }
          </Geographies>
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedProperties;
                const districtName = properties?.name;
                const centroid = (geo as any).centroid as [number, number] | undefined;

                if (!centroid || !districtName) return null;
                
                let fontSize = 3.5; 
                let yOffset = 0;
                if (["Kathmandu", "Kaski", "Pokhara", "Lumbini", "Morang"].includes(districtName)) {
                    fontSize = 4.5;
                }
                 if (districtName === "Kathmandu") {
                     fontSize = 5.5;
                 }
                 if (districtName === "Baglung" || districtName === "Myagdi") yOffset = 1.5;


                return (
                  <Marker key={`label-${geo.rsmKey || properties.id || districtName + Math.random()}`} coordinates={centroid}>
                    <text
                      x={0}
                      y={yOffset}
                      fontSize={fontSize}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      className="fill-foreground/70 dark:fill-background/90 pointer-events-none select-none font-medium"
                      style={{ paintOrder: "stroke", stroke: "hsl(var(--card))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                    >
                      {districtName}
                    </text>
                  </Marker>
                );
              })
            }
          </Geographies>

          {majorCities.map((city) => {
            const isSelected = selectedFeatureInfo?.feature.type === 'City' && selectedFeatureInfo?.feature.id === city.id;
            let labelFontSize = 4.5; 
            if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) labelFontSize = 5.5;
            if (city.name === "Kathmandu") labelFontSize = 6.5;

            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                onClick={(event) => handleFeatureClick(city, 'City', event as unknown as React.MouseEvent<SVGGElement>)}
              >
                 <g
                  className={cn(
                    "transition-all group cursor-pointer",
                    isSelected ? "text-accent" : "text-primary hover:text-accent/80"
                  )}
                >
                  <circle
                    r={isSelected ? 4.5 : 2.5} 
                    className={cn(
                      isSelected ? "fill-accent stroke-accent-foreground" : "fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground"
                    )}
                    strokeWidth={0.75}
                  />
                  <text
                    textAnchor="middle"
                    y={isSelected ? -7 : -5} 
                    fontSize={labelFontSize}
                    className={cn(
                      "select-none pointer-events-none transition-opacity duration-150 font-semibold",
                      isSelected ? "opacity-100 fill-accent" : "opacity-80 fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent"
                    )}
                     style={{ paintOrder: "stroke", stroke: "hsl(var(--card))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
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
          style={infoBoxStyle}
          className={cn(
            "fixed p-0 shadow-2xl border border-border bg-card text-card-foreground rounded-lg transition-all duration-200 ease-out z-[60]",
            "w-52 sm:w-56 md:w-60 flex flex-col overflow-hidden", // Reduced width
            infoBoxStyle.visibility === 'visible' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="flex flex-row items-start justify-between p-2 space-y-0 border-b bg-muted/30 rounded-t-lg"> {/* Reduced padding */}
            <div className="space-y-0.5">
              <CardTitle className="text-xs sm:text-sm font-bold leading-tight flex items-center text-primary"> {/* Smaller font */}
                <MapPin className="w-3 h-3 mr-1 flex-shrink-0 text-primary/80" /> {/* Smaller icon */}
                {selectedFeatureInfo.feature.name || "Details"}
              </CardTitle>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0" onClick={handleCloseInfoBox} aria-label="Close info box"> {/* Smaller button */}
              <XIcon className="w-3 h-3" /> {/* Smaller icon */}
            </Button>
          </CardHeader>
          <CardContent className="p-2 text-[10px] sm:text-xs space-y-1 overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent max-h-[6rem] sm:max-h-24"> {/* Reduced padding, font, max-h */}
            {currentSelectedCache?.isLoadingAI || currentSelectedCache?.isLoadingFirestore ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> {/* Smaller icon */}
                {currentSelectedCache?.isLoadingAI ? "AI thinking..." : "Loading..."}
              </div>
            ) : (
              <p className="text-muted-foreground line-clamp-2 sm:line-clamp-3"> 
                {selectedFeatureInfo.feature.type === 'District' && currentSelectedCache?.aiDescription
                  ? currentSelectedCache.aiDescription
                  : currentSelectedCache?.description || selectedFeatureInfo.feature.description || `Explore ${selectedFeatureInfo.feature.name}, a captivating part of Nepal.`
                }
              </p>
            )}
             {currentSelectedCache?.population && (
                <p className="text-muted-foreground/80 mt-0.5 text-[9px] sm:text-[10px]">Population: {Number(currentSelectedCache.population).toLocaleString()}</p>
            )}
          </CardContent>
          {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-1.5 sm:p-2 border-t pt-1 sm:pt-1.5 mt-auto"> {/* Reduced padding */}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-6 text-[9px] sm:text-[10px] text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground/90" /* Smaller text/height */
                onClick={() => {
                  if (selectedFeatureInfo.feature.link) router.push(selectedFeatureInfo.feature.link);
                  handleCloseInfoBox();
                }}
                aria-label={`Learn more about ${selectedFeatureInfo.feature.name}`}
              >
                Learn More <ExternalLink className="ml-1 h-2.5 w-2.5" /> 
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
       {(currentSelectedCache?.isLoadingAI || currentSelectedCache?.isLoadingFirestore) && !isLoadingMapGeometry && (
          <div className="absolute bottom-2 right-2 p-1.5 px-2 bg-muted/80 text-muted-foreground text-[10px] rounded-md flex items-center gap-1.5 z-50">
              <Loader2 className="h-3 w-3 animate-spin" />
              {currentSelectedCache?.isLoadingAI ? "AI thinking..." : "Loading details..."}
          </div>
      )}
    </div>
  );
}
