
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData, HomepageMapProps, SelectedFeatureDetails, DetailsCacheEntry, ExtendedFeatureProperties } from '@/types';
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

// Corrected geometric centroid calculation function
const getCentroid = (geo: any): [number, number] | undefined => {
  if (!geo || !geo.geometry) {
    // console.warn("getCentroid: Invalid geo object or missing geometry", geo);
    return undefined;
  }

  const { type, coordinates } = geo.geometry;
  let path: [number, number][] | undefined;

  if (type === 'Polygon' && coordinates && coordinates[0] && coordinates[0].length >= 3) {
    path = coordinates[0]; // Use the first ring (outer boundary)
  } else if (type === 'MultiPolygon' && coordinates && coordinates[0] && coordinates[0][0] && coordinates[0][0].length >= 3) {
    path = coordinates[0][0]; // Use the first ring of the first polygon for MultiPolygons
  }

  if (path) {
    let x = 0;
    let y = 0;
    let signedArea = 0;

    for (let i = 0; i < path.length; i++) {
      const x0 = path[i][0];
      const y0 = path[i][1];
      const x1 = path[(i + 1) % path.length][0]; // Loop back to the first point
      const y1 = path[(i + 1) % path.length][1];

      const a = x0 * y1 - x1 * y0;
      signedArea += a;
      x += (x0 + x1) * a;
      y += (y0 + y1) * a;
    }

    if (signedArea === 0) {
      // Fallback for degenerate polygons (e.g., a line) or very small polygons
      // Return average of points or first point if area is zero
      if (path.length > 0) {
        let avgX = 0, avgY = 0;
        for(const p of path) { avgX += p[0]; avgY += p[1]; }
        return [avgX / path.length, avgY / path.length];
      }
      // console.warn("getCentroid: Degenerate polygon, signedArea is 0", geo);
      return undefined;
    }

    const finalArea = signedArea * 0.5;
    return [x / (6 * finalArea), y / (6 * finalArea)];
  }

  // console.warn("getCentroid: Could not determine a valid path for centroid calculation", geo);
  return undefined;
};


export function HomepageMap({ initialMapData }: HomepageMapProps) {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [displayErrorMessage, setDisplayErrorMessage] = useState<string | null>(null);

  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDetails | null>(null);
  const [detailsCache, setDetailsCache] = useState<DetailsCacheEntry>({});
  const [infoBoxStyle, setInfoBoxStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const majorCities: CityMapData[] = [
    { id: 'kathmandu', name: 'Kathmandu', type: 'City', coordinates: [85.3240, 27.7172], description: "The vibrant capital, rich in culture and ancient temples.", population: 1442271, link: '/districts?name=Kathmandu', highlight: true },
    { id: 'pokhara', name: 'Pokhara', type: 'City', coordinates: [83.9856, 28.2096], description: "A picturesque city by Phewa Lake with stunning Himalayan views.", population: 400000, link: '/districts?name=Kaski', highlight: true },
    { id: 'lumbini', name: 'Lumbini', type: 'City', coordinates: [83.2747, 27.4670], description: "The sacred birthplace of Lord Buddha, a UNESCO World Heritage site.", population: 70000, link: '/districts?name=Rupandehi', highlight: true },
    { id: 'biratnagar', name: 'Biratnagar', type: 'City', coordinates: [87.2798, 26.4525], description: "Major industrial city and hub in Eastern Nepal.", population: 242548, link: '/districts?name=Morang', highlight: true },
    { id: 'nepalgunj', name: 'Nepalgunj', type: 'City', coordinates: [81.6167, 28.0500], description: "Key transport and trade hub in Western Nepal, near Indian border.", population: 138951, link: '/districts?name=Banke', highlight: true },
    { id: 'janakpur', name: 'Janakpur', type: 'City', coordinates: [85.9228, 26.7285], description: "Historic city, religious center, and birthplace of Goddess Sita.", population: 195438, link: '/districts?name=Dhanusha', highlight: true },
  ];

  const processRawMapData = useCallback((rawData: Topology | null): { features: ExtendedFeature[] | null; error?: string } => {
    if (!rawData) return { features: null, error: "Raw map data provided is null." };
    if (typeof rawData.objects !== 'object' || rawData.objects === null || Object.keys(rawData.objects).length === 0) {
      return { features: null, error: `Invalid TopoJSON: 'objects' property is missing or empty.` };
    }

    const layerKey = TOPOJSON_OBJECT_KEY; // "nepal"
    const layer = rawData.objects[layerKey];

    if (!layer || typeof layer !== 'object') {
      return { features: null, error: `Invalid TopoJSON: Layer '${layerKey}' not found in objects. Available keys: ${Object.keys(rawData.objects).join(', ')}` };
    }
    
    let geoJsonCollection;
    try {
        // @ts-ignore
        geoJsonCollection = topojsonFeature(rawData, layer);
    } catch (e) {
        return { features: null, error: `Error converting TopoJSON layer '${layerKey}' to GeoJSON: ${e instanceof Error ? e.message : String(e)}` };
    }

    if (geoJsonCollection.type !== "FeatureCollection" || !Array.isArray(geoJsonCollection.features)) {
        return { features: null, error: `Layer '${layerKey}' is not a valid GeoJSON FeatureCollection after TopoJSON conversion.` };
    }
    
    const mappedFeatures = geoJsonCollection.features.map((feature: any, index: number): ExtendedFeature | null => {
      const props = feature.properties || {};
      const districtName = props.name || props.DIST_EN || props.ADM1_EN || `District ${index + 1}`;
      const featureId = String(props.id || props.OBJECTID || props.DIST_EN || props.name || `district-${index}`);

      if (!districtName) return null;

      return {
        ...feature,
        id: featureId, 
        properties: {
          ...props,
          id: featureId,
          name: districtName,
          type: 'District',
          link: `/districts?name=${encodeURIComponent(districtName)}`,
          description: props.description || `Explore ${districtName}, a diverse district in Nepal.`
        } as ExtendedFeatureProperties,
      };
    }).filter(Boolean) as ExtendedFeature[];

    if (mappedFeatures.length === 0) {
        return { features: [], error: "No features with usable names found after mapping TopoJSON properties." };
    }
    return { features: mappedFeatures };
  }, []);


  useEffect(() => {
    const fetchDataAsync = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setMapData(null); 

      try {
        let dataToProcess: Topology | null = initialMapData || null;

        if (!dataToProcess) {
          const geoRes = await fetch(NEPAL_GEO_URL);
          if (!geoRes.ok) {
            const errorText = await geoRes.text();
            throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0,300)}`);
          }
          dataToProcess = await geoRes.json() as Topology;
        }
        
        const processingResult = processRawMapData(dataToProcess);

        if (processingResult.features && processingResult.features.length > 0) {
            setMapData(processingResult.features);
            setFetchError(null);
        } else {
            const errorMsg = processingResult.error || `No valid map features found or map data is empty after processing. Ensure '${TOPOJSON_OBJECT_KEY}' layer exists and contains geometries.`;
            // console.error("HomepageMap: fetchDataAsync -", errorMsg);
            setFetchError(errorMsg);
            setMapData(null);
        }
      } catch (err) {
        let errorMessage = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        // console.error("HomepageMap: fetchDataAsync error catch -", errorMessage, err);
        setFetchError(errorMessage);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchDataAsync();
  }, [initialMapData, processRawMapData]);


  const handleFeatureClick = useCallback((featureData: ExtendedFeatureProperties, event: React.MouseEvent) => {
    event.stopPropagation();
    const { clientX, clientY } = event;
    
    setSelectedFeatureInfo({
      feature: {
        id: featureData.id,
        name: featureData.name,
        type: featureData.type,
        description: featureData.description,
        link: featureData.link,
        population: featureData.population,
      },
      clientX: clientX,
      clientY: clientY,
    });

    if (featureData.type === 'District' && featureData.name) {
      const featureId = featureData.id;
      setDetailsCache(prev => ({ ...prev, [featureId]: { ...prev[featureId], aiDescription: undefined, isLoadingAI: false, aiError: null } }));
    }
  }, []);


  useEffect(() => {
    const currentFeature = selectedFeatureInfo?.feature;
    if (!currentFeature || currentFeature.type !== 'District' || !currentFeature.name) {
      setIsFetchingDescription(false);
      return;
    }

    const featureId = currentFeature.id;
    const cachedEntry = detailsCache[featureId];

    if (!cachedEntry?.aiDescription && !cachedEntry?.isLoadingAI && !cachedEntry?.aiError) {
      setDetailsCache(prev => ({ ...prev, [featureId]: { ...prev[featureId], isLoadingAI: true, aiError: null } }));
      setIsFetchingDescription(true);

      getDistrictDescription({ districtName: currentFeature.name })
        .then(result => {
          setDetailsCache(prev => ({ ...prev, [featureId]: { ...prev[featureId], aiDescription: result.description, isLoadingAI: false } }));
        })
        .catch(err => {
          toast({ title: "AI Description Error", description: `Could not fetch AI insights for ${currentFeature.name}.`, variant: "default" });
          setDetailsCache(prev => ({ ...prev, [featureId]: { ...prev[featureId], isLoadingAI: false, aiError: err.message } }));
        })
        .finally(() => setIsFetchingDescription(false));
    } else {
       setIsFetchingDescription(cachedEntry?.isLoadingAI || false);
    }
  }, [selectedFeatureInfo, detailsCache, toast]);


  useEffect(() => {
    if (selectedFeatureInfo && mapContainerRef.current) {
        const { clientX, clientY } = selectedFeatureInfo;
        
        const INFO_BOX_WIDTH = 256; // Approx w-64 based on current Card styling
        const INFO_BOX_HEIGHT_ESTIMATE = 200; 
        const OFFSET = 20;

        let newLeft = clientX + OFFSET;
        let newTop = clientY + OFFSET;

        if (clientX + INFO_BOX_WIDTH + OFFSET > window.innerWidth) {
            newLeft = clientX - INFO_BOX_WIDTH - OFFSET;
        }
        if (clientY + INFO_BOX_HEIGHT_ESTIMATE + OFFSET > window.innerHeight) {
            newTop = clientY - INFO_BOX_HEIGHT_ESTIMATE - OFFSET;
        }
        
        newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - INFO_BOX_WIDTH - 10));
        newTop = Math.max(10, Math.min(newTop, window.innerHeight - INFO_BOX_HEIGHT_ESTIMATE - 10));

        setInfoBoxStyle({
            position: 'fixed',
            left: `${newLeft}px`,
            top: `${newTop}px`,
            visibility: 'visible',
            zIndex: 50,
        });
    } else {
        setInfoBoxStyle({ visibility: 'hidden', zIndex: -1 });
    }
  }, [selectedFeatureInfo]);

  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    setIsFetchingDescription(false);
  }, []);
  
  const handleMapClick = useCallback(() => {
    if (selectedFeatureInfo) { 
      handleCloseInfoBox();
    }
  },[selectedFeatureInfo, handleCloseInfoBox]);


  useEffect(() => {
    if (fetchError) {
      let specificMessage = fetchError;
       if (fetchError.includes("client is offline") || fetchError.includes("Failed to get document")) {
        specificMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
      } else if (fetchError.includes("Invalid GeoJSON") || fetchError.includes("Invalid TopoJSON") || fetchError.includes("layer key") || fetchError.includes("No valid map features")) {
        specificMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}'). Original error: ${fetchError}`;
      } else if (fetchError.includes("404")) {
         specificMessage = `Map Error: The map data file (${NEPAL_GEO_URL}) was not found. Please ensure it exists in the public/data directory.`;
      } else if (fetchError.includes("extract valid geometries") || fetchError.includes("empty or malformed")) {
         specificMessage = `Map Error: Could not process map data from ${NEPAL_GEO_URL}. The file might be valid JSON, but the expected geometry layer ('${TOPOJSON_OBJECT_KEY}') is missing or doesn't contain usable features.`;
      }
      setDisplayErrorMessage(specificMessage);
    } else {
      setDisplayErrorMessage(null);
    }
  }, [fetchError]);
  

  if (isLoadingMapGeometry && !initialMapData) {
    return <Skeleton className="aspect-[16/9] w-full h-full bg-muted/50 rounded-xl" />;
  }
  
  if (displayErrorMessage || !mapData) {
    // console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData (actual value):", mapData, "mapData valid (boolean):", !!mapData && Array.isArray(mapData) && mapData.length > 0);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable or invalid. Please ensure the TopoJSON/GeoJSON file is correctly placed and structured."}</p>
      </div>
    );
  }
   if (!Array.isArray(mapData) || mapData.length === 0) {
       return (
         <div className="aspect-[16/9] w-full bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex flex-col items-center justify-center text-yellow-700 dark:text-yellow-300 p-4 text-center">
           <Globe className="h-10 w-10 mb-2" />
           <p className="font-semibold text-lg mb-1">No Map Features</p>
           <p className="text-sm">No geographical features to display. Check TopoJSON processing and file content, especially the layer name ('{TOPOJSON_OBJECT_KEY}').</p>
         </div>
       );
   }

  const currentSelectedCacheData = selectedFeatureInfo ? detailsCache[selectedFeatureInfo.feature.id] : null;

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full h-full bg-lime-100 dark:bg-green-900/30 cursor-default overflow-hidden"
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
              geographies.map((geo: any) => {
                const properties = geo.properties as ExtendedFeatureProperties;
                const geoIdForSelection = String(geo.rsmKey || properties.id || properties.name);
                const isSelected =
                  selectedFeatureInfo?.feature.type === 'District' &&
                  selectedFeatureInfo?.feature.id === geoIdForSelection;

                return (
                  <Geography
                    key={geoIdForSelection} 
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(properties, event)}
                    className={cn(
                      "transition-colors duration-150 ease-in-out outline-none",
                      isSelected 
                        ? "fill-accent stroke-accent-foreground stroke-[1.5px]"
                        : "fill-card dark:fill-slate-700 stroke-border dark:stroke-slate-500 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer"
                    )}
                    aria-label={properties.name}
                  />
                );
              })
            }
          </Geographies>
           <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map((geo: any) => {
                const districtProperties = geo.properties as ExtendedFeatureProperties;
                const districtName = districtProperties?.name;
                const centroid = (geo as any).centroid as [number, number] | undefined || getCentroid(geo);
                const geoIdForSelection = String(geo.rsmKey || districtProperties?.id || districtProperties?.name || `label-${Math.random()}`);

                if (!centroid || !districtName ) return null;
                
                let fontSize = 3.5; // Reduced base font size
                if (["Kathmandu", "Kaski", "Chitwan", "Morang", "Rupandehi", "Lumbini", "Janakpur", "Biratnagar", "Nepalgunj"].includes(districtName)) {
                    fontSize = 4; // Slightly larger for key districts
                }
                if (districtName === "Kathmandu") fontSize = 4.5; // Largest for Kathmandu
                
                return (
                  <Marker key={geoIdForSelection} coordinates={centroid}>
                    <text
                      x={0}
                      y={0}
                      fontSize={fontSize}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      className="fill-foreground/70 dark:fill-background/90 pointer-events-none select-none font-medium"
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
            const isSelected = selectedFeatureInfo?.feature.type === 'City' && selectedFeatureInfo?.feature.id === city.id;
            let labelFontSize = 4; 
            if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) labelFontSize = 4.5;
            if (city.name === "Kathmandu") labelFontSize = 5;
            
            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                onClick={(event: React.MouseEvent<SVGGElement>) => handleCityClick(city, event)}
              >
                 <g
                  className={cn(
                    "transition-all group cursor-pointer",
                    isSelected ? "text-accent" : "text-primary hover:text-accent/80"
                  )}
                >
                  <circle
                    r={isSelected ? 3.5 : 2.5} 
                    className={cn(
                      isSelected ? "fill-accent stroke-accent-foreground" : "fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground"
                    )}
                    strokeWidth={0.5}
                  />
                  <text
                    textAnchor="middle"
                    y={isSelected ? -6 : -5} 
                    fontSize={labelFontSize}
                    className={cn(
                      "select-none pointer-events-none transition-opacity duration-150 font-semibold",
                       isSelected ? "opacity-100 fill-accent" : "fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent"
                    )}
                     style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.25px", strokeLinejoin: "round" }}
                  >
                    {city.name}
                  </text>
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {selectedFeatureInfo && selectedFeatureInfo.feature && (
        <Card
          style={infoBoxStyle}
          className={cn(
            "fixed p-0 w-56 sm:w-60 md:w-64 shadow-xl border border-border bg-card text-card-foreground rounded-lg transition-all duration-200 ease-out",
             infoBoxStyle.visibility === 'visible' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="flex flex-row items-start justify-between p-2 space-y-0 border-b">
            <CardTitle className="text-base md:text-lg font-semibold leading-tight flex items-center text-primary">
              <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
              {selectedFeatureInfo.feature.name || "Details"}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0" onClick={handleCloseInfoBox} aria-label="Close info box">
              <XIcon className="w-3.5 h-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-2 text-[11px] md:text-xs space-y-1 max-h-[70px] sm:max-h-[80px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            {(isFetchingDescription && selectedFeatureInfo.feature.type === 'District') || (currentSelectedCacheData?.isLoadingFirestore && selectedFeatureInfo.feature.type === 'District') ? (
              <div className="flex items-center text-muted-foreground text-[10px] md:text-[11px]">
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Loading description...
              </div>
            ) : (
                 <p className="text-muted-foreground line-clamp-3">
                 {selectedFeatureInfo.feature.type === 'District'
                   ? currentSelectedCacheData?.aiDescription || currentSelectedCacheData?.description || selectedFeatureInfo.feature.description || `Explore ${selectedFeatureInfo.feature.name}, a diverse district in Nepal.`
                   : currentSelectedCacheData?.description || selectedFeatureInfo.feature.description || `Discover ${selectedFeatureInfo.feature.name}.`}
                  {currentSelectedCacheData?.aiError && selectedFeatureInfo.feature.type === 'District' && <span className="text-destructive/80 text-[9px] md:text-[10px] block mt-0.5">AI description unavailable.</span>}
               </p>
            )}
            {currentSelectedCacheData?.population && (
                <p className="text-muted-foreground/80 mt-0.5 text-[10px] md:text-[11px]">Population: {Number(currentSelectedCacheData.population).toLocaleString()}</p>
            )}
          </CardContent>
          {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-2 border-t pt-1.5 mt-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-6 text-[10px] md:text-xs text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
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
       {(currentSelectedCacheData?.isLoadingFirestore || currentSelectedCacheData?.isLoadingAI) && !isLoadingMapGeometry && (
          <div className="absolute bottom-2 right-2 p-1.5 bg-muted/80 text-muted-foreground text-[10px] md:text-xs rounded-md flex items-center gap-1.5 z-50">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Loading details...
          </div>
      )}
    </div>
  );
}

