
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData, HomepageMapProps, SelectedFeatureDetails, DetailsCacheEntry, ExtendedFeatureProperties } from '@/types'; // Make sure ExtendedFeatureProperties is defined
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

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // Adjusted to "nepal" based on previous error logs

// Function to calculate centroid (simplified, might need refinement for complex polygons)
const getCentroid = (geo: any): [number, number] | undefined => {
    if (!geo || !geo.geometry) return undefined;
    const { type, coordinates } = geo.geometry;
    let path: [number, number][] | undefined;

    if (type === 'Polygon' && coordinates && coordinates[0] && coordinates[0].length >= 3) {
        path = coordinates[0];
    } else if (type === 'MultiPolygon' && coordinates && coordinates[0] && coordinates[0][0] && coordinates[0][0].length >= 3) {
        path = coordinates[0][0];
    }

    if (path) {
        let x = 0;
        let y = 0;
        let signedArea = 0;

        for (let i = 0; i < path.length; i++) {
            const x0 = path[i][0];
            const y0 = path[i][1];
            const x1 = path[(i + 1) % path.length][0];
            const y1 = path[(i + 1) % path.length][1];

            const a = x0 * y1 - x1 * y0;
            signedArea += a;
            x += (x0 + x1) * a;
            y += (y0 + y1) * a;
        }

        if (signedArea === 0) {
            if (path.length > 0) {
                let avgX = 0, avgY = 0;
                for (const p of path) { avgX += p[0]; avgY += p[1]; }
                return [avgX / path.length, avgY / path.length];
            }
            return undefined;
        }
        const finalArea = signedArea * 0.5;
        return [x / (6 * finalArea), y / (6 * finalArea)];
    }
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
    const layerKey = TOPOJSON_OBJECT_KEY;
    const layer = rawData.objects[layerKey];

    if (!layer || typeof layer !== 'object') {
      return { features: null, error: `Invalid TopoJSON: Layer '${layerKey}' not found in objects. Available keys: ${Object.keys(rawData.objects).join(', ')}` };
    }
    
    let geoJsonCollection;
    try {
        geoJsonCollection = topojsonFeature(rawData, layer);
    } catch (e) {
        return { features: null, error: `Error converting TopoJSON layer '${layerKey}' to GeoJSON: ${e instanceof Error ? e.message : String(e)}` };
    }

    if (geoJsonCollection.type !== "FeatureCollection" || !Array.isArray(geoJsonCollection.features)) {
        return { features: null, error: `Layer '${layerKey}' is not a valid GeoJSON FeatureCollection after conversion.` };
    }
    
    const mappedFeatures = geoJsonCollection.features.map((feature: any, index: number): ExtendedFeature | null => {
      const props = feature.properties || {};
      const districtName = props.name || props.DIST_EN || props.ADM1_EN || `District ${index + 1}`;
      const featureId = String(props.id || props.OBJECTID || props.DIST_EN || props.name || `district-${index}`);

      if (!districtName) return null; // Skip features without a usable name

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
        
        console.log("HomepageMap: Data to process (initial or fetched):", JSON.stringify(dataToProcess, null, 2).substring(0, 500) + "...");
        const processingResult = processRawMapData(dataToProcess);

        if (processingResult.features && processingResult.features.length > 0) {
            setMapData(processingResult.features);
            setFetchError(null); // Success
        } else {
            const errorMsg = processingResult.error || `No valid map features found after processing ${dataToProcess === initialMapData ? 'initialMapData' : NEPAL_GEO_URL}. Check TopoJSON structure and layer key ('${TOPOJSON_OBJECT_KEY}').`;
            console.error("HomepageMap: fetchDataAsync -", errorMsg);
            setFetchError(errorMsg);
            setMapData(null);
        }
      } catch (err) {
        let errorMessage = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        if (errorMessage.includes("offline") || errorMessage.includes("Failed to get document")) {
          errorMessage = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${errorMessage}`;
        } else if (errorMessage.includes("404")) {
            errorMessage = `Map data file (${NEPAL_GEO_URL}) not found. Please ensure it exists in the public/data directory.`;
        }
        console.error("HomepageMap: fetchDataAsync error catch -", errorMessage, err);
        setFetchError(errorMessage);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    if(!mapData) { // Fetch only if mapData isn't already set (e.g., by initialMapData)
        fetchDataAsync();
    } else if (initialMapData && mapData !== initialMapData.objects[TOPOJSON_OBJECT_KEY]?.geometries) {
        // If initialMapData is provided but mapData is somehow different (or not yet processed from it), re-process
        const processingResult = processRawMapData(initialMapData);
         if (processingResult.features && processingResult.features.length > 0) {
            setMapData(processingResult.features);
            setFetchError(null);
        } else {
            const errorMsg = processingResult.error || "Failed to process initialMapData.";
            setFetchError(errorMsg);
            setMapData(null);
        }
        setIsLoadingMapGeometry(false);
    } else {
        setIsLoadingMapGeometry(false); // Already have data
    }
  }, [initialMapData, processRawMapData]); // Removed mapData from dependencies

  const handleFeatureClick = useCallback(
    (featureType: 'District' | 'City', featureData: ExtendedFeatureProperties, event: React.MouseEvent | any) => {
      event.stopPropagation();
      const { clientX, clientY } = event;

      console.log(`${featureType} Clicked:`, featureData.name, "Event clientX:", clientX, "clientY:", clientY, "Feature ID:", featureData.id);

      setSelectedFeatureInfo({
        feature: { ...featureData },
        clientX: clientX,
        clientY: clientY,
      });
    },
    [] // Removed detailsCache and getDistrictDescription to simplify, will re-add AI fetch if needed
  );
  
  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);

  const handleMapClick = useCallback(() => {
    if (selectedFeatureInfo) { 
      handleCloseInfoBox();
    }
  },[selectedFeatureInfo, handleCloseInfoBox]);

  useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
    if (selectedFeatureInfo && mapContainerRef.current) {
        const { clientX, clientY } = selectedFeatureInfo;
        const INFO_BOX_WIDTH_ESTIMATE = 256; // Approx w-64
        const INFO_BOX_HEIGHT_ESTIMATE = 200; // Approximate
        const OFFSET = 15;

        let newLeft = clientX + OFFSET;
        let newTop = clientY + OFFSET;

        // Adjust if too close to right edge
        if (newLeft + INFO_BOX_WIDTH_ESTIMATE > window.innerWidth) {
            newLeft = clientX - INFO_BOX_WIDTH_ESTIMATE - OFFSET;
        }
        // Adjust if too close to bottom edge
        if (newTop + INFO_BOX_HEIGHT_ESTIMATE > window.innerHeight) {
            newTop = clientY - INFO_BOX_HEIGHT_ESTIMATE - OFFSET;
        }
        
        // Ensure it's not off-screen left or top
        newLeft = Math.max(10, newLeft);
        newTop = Math.max(10, newTop);

        setInfoBoxStyle({
            position: 'fixed',
            left: `${newLeft}px`,
            top: `${newTop}px`,
            visibility: 'visible',
            zIndex: 50, // Ensure it's above map elements
        });
    } else {
        setInfoBoxStyle({ visibility: 'hidden', zIndex: -1 });
    }
  }, [selectedFeatureInfo]);
  
  useEffect(() => {
    // Fetch AI description when a district is selected and not already cached
    const currentFeature = selectedFeatureInfo?.feature;
    if (currentFeature && currentFeature.type === 'District' && currentFeature.name) {
      const featureId = currentFeature.id;
      const cached = detailsCache[featureId];

      if (!cached?.aiDescription && !cached?.isLoadingAI && !cached?.aiError) {
        setDetailsCache(prev => ({
          ...prev,
          [featureId]: { ...prev[featureId], isLoadingAI: true, aiError: null }
        }));
        getDistrictDescription({ districtName: currentFeature.name })
          .then(result => {
            setDetailsCache(prev => ({
              ...prev,
              [featureId]: { ...prev[featureId], aiDescription: result.description, isLoadingAI: false }
            }));
          })
          .catch(err => {
            console.error(`Error fetching AI description for ${currentFeature.name}:`, err);
            toast({ title: "AI Description Error", description: `Could not fetch AI insights for ${currentFeature.name}.`, variant: "default" });
            setDetailsCache(prev => ({
              ...prev,
              [featureId]: { ...prev[featureId], isLoadingAI: false, aiError: err.message || 'Failed to load AI description' }
            }));
          });
      }
    }
  }, [selectedFeatureInfo, detailsCache, toast]); // Removed getDistrictDescription as it's stable

  useEffect(() => {
    setDisplayErrorMessage(fetchError);
  }, [fetchError]);

  if (isLoadingMapGeometry && !mapData) {
    return <Skeleton className="aspect-[16/9] w-full h-full bg-muted/50 rounded-xl" />;
  }
  
  if (displayErrorMessage || !mapData || mapData.length === 0) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData && mapData.length > 0);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable or invalid. Please ensure the TopoJSON file is correctly placed, structured, and contains a valid layer for Nepal."}</p>
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
          {/* Geographies for Provinces/Districts */}
          <Geographies 
            geography={mapData} 
          >
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedFeatureProperties;
                // Ensure a consistent and reliable ID is used for comparison.
                // Prefer geo.id, then geo.properties.id, then a name-based fallback.
                const geoIdForSelection = String(
                    geo.id || // If geoJSON feature has an id
                    properties.id || // If properties has an id
                    properties.name || // Fallback to name
                    geo.rsmKey // react-simple-maps unique key
                );

                const isSelected =
                  selectedFeatureInfo?.feature.type === 'District' &&
                  selectedFeatureInfo?.feature.id === geoIdForSelection;

                return (
                  <Geography
                    key={geoIdForSelection} 
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick('District', properties, event)}
                    className={cn(
                      "transition-colors duration-150 ease-in-out outline-none cursor-pointer",
                      isSelected 
                        ? "fill-accent stroke-accent-foreground stroke-[1.5px]"
                        : "fill-card dark:fill-slate-700 stroke-border dark:stroke-slate-500 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30"
                    )}
                    aria-label={properties.name}
                  />
                );
              })
            }
          </Geographies>
          {/* Geographies for Labels */}
           <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map((geo: any) => {
                const properties = geo.properties as ExtendedFeatureProperties;
                const districtName = properties?.name;
                const centroid = getCentroid(geo);
                
                if (!centroid || !districtName ) return null;
                
                let fontSize = 3.5;
                if (["Kathmandu", "Kaski", "Chitwan", "Morang", "Rupandehi"].includes(districtName)) { // Kaski for Pokhara, Rupandehi for Lumbini
                    fontSize = 4;
                }
                if (districtName === "Kathmandu") fontSize = 4.5;
                
                return (
                  <Marker key={`label-${geo.rsmKey || properties.id || districtName}`} coordinates={centroid}>
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
          {/* Markers for Major Cities */}
          {majorCities.map((city) => {
             const isSelected = selectedFeatureInfo?.feature.type === 'City' && selectedFeatureInfo?.feature.id === city.id;
             let labelFontSize = 4;
             if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) labelFontSize = 4.5;
             if (city.name === "Kathmandu") labelFontSize = 5;

            return(
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                onClick={(event: React.MouseEvent<SVGGElement>) => handleFeatureClick('City', city as unknown as ExtendedFeatureProperties, event)}
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
                    y={isSelected ? -8 : -7} 
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

      {/* Info Box Card - Positioned by click */}
      {selectedFeatureInfo && selectedFeatureInfo.feature && (
        <Card
            style={infoBoxStyle}
            className={cn(
                "fixed p-0 w-56 sm:w-60 md:w-64 shadow-2xl border border-border bg-card text-card-foreground rounded-lg transition-all duration-200 ease-out",
                infoBoxStyle.visibility === 'visible' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            )}
            onClick={(e) => e.stopPropagation()} // Prevent map click handler when clicking inside info box
            >
            <CardHeader className="flex flex-row items-start justify-between p-2.5 space-y-0 border-b">
                <CardTitle className="text-base md:text-lg font-semibold leading-tight flex items-center text-primary">
                <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-primary/80" />
                {selectedFeatureInfo.feature.name || "Details"}
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0" onClick={handleCloseInfoBox} aria-label="Close info box">
                <XIcon className="w-3.5 h-3.5" />
                </Button>
            </CardHeader>
            <CardContent className="p-2.5 text-xs md:text-sm space-y-1 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                {currentSelectedCacheData?.isLoadingAI && selectedFeatureInfo.feature.type === 'District' && (
                     <div className="flex items-center text-muted-foreground text-[10px] md:text-[11px]">
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Loading...
                    </div>
                )}
                {currentSelectedCacheData?.aiDescription && selectedFeatureInfo.feature.type === 'District' && !currentSelectedCacheData.isLoadingAI && (
                    <p className="text-muted-foreground line-clamp-3">{currentSelectedCacheData.aiDescription}</p>
                )}
                {!currentSelectedCacheData?.isLoadingAI && !currentSelectedCacheData?.aiDescription && selectedFeatureInfo.feature.description && (
                    <p className="text-muted-foreground line-clamp-3">{selectedFeatureInfo.feature.description}</p>
                )}
                 {!currentSelectedCacheData?.isLoadingAI && !currentSelectedCacheData?.aiDescription && !selectedFeatureInfo.feature.description && (
                    <p className="text-muted-foreground italic line-clamp-3">Explore {selectedFeatureInfo.feature.name}, a captivating area in Nepal.</p>
                )}
                {currentSelectedCacheData?.aiError && selectedFeatureInfo.feature.type === 'District' && (
                     <p className="text-destructive/80 text-[9px] md:text-[10px] mt-0.5">AI description currently unavailable.</p>
                )}
                {currentSelectedCacheData?.population && (
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px] md:text-[11px]">Population: {Number(currentSelectedCacheData.population).toLocaleString()}</p>
                )}
            </CardContent>
            {selectedFeatureInfo.feature.link && (
                <CardFooter className="p-2.5 border-t pt-2 mt-auto">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-[10px] md:text-xs text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
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
          <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
              <Loader2 className="h-3 w-3 animate-spin" />
          </div>
      )}
    </div>
  );
}
