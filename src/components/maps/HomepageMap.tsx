
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData, HomepageMapProps, SelectedFeatureDetails as ExtendedProperties } from '@/types'; // Adjusted type import
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
// Firebase is not directly used in this component anymore for fetching on mount
// import { db } from '@/lib/firebase';
// import { doc, getDoc } from 'firebase/firestore';

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // Key in TopoJSON objects that holds the geometry collection

interface InfoBoxStyle {
  left: string;
  top: string;
  visibility: 'visible' | 'hidden';
  transform?: string;
}

interface CachedDetailEntry {
  population?: number | null;
  description?: string | null;
  aiDescription?: string | null;
  isLoadingFirestore?: boolean;
  isLoadingAI?: boolean;
}

export function HomepageMap({ initialMapData: prefetchedMapData }: HomepageMapProps) {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<ExtendedProperties & { clientX: number; clientY: number; } | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, CachedDetailEntry>>({});
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
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setMapData(null);

      try {
        let rawMapData: Topology | null = prefetchedMapData;

        if (!rawMapData) {
          console.log("HomepageMap: Prefetched map data not available, fetching from URL:", NEPAL_GEO_URL);
          const geoRes = await fetch(NEPAL_GEO_URL);
          if (!geoRes.ok) {
            const errorText = await geoRes.text();
            throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0,200)}...`);
          }
          rawMapData = await geoRes.json() as Topology;
          console.log("HomepageMap: TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 300) + "...");
        } else {
          console.log("HomepageMap: Using prefetched map data.");
        }

        if (rawMapData && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          // @ts-ignore topojson-client types can be tricky with specific TopoJSON structures
          const geoJsonFeatures = topojsonFeature(rawMapData, layer!).features as ExtendedFeature[];
          
          if (geoJsonFeatures && geoJsonFeatures.length > 0) {
            const processedFeatures = geoJsonFeatures.map((f, index) => ({
              ...f,
              properties: {
                ...f.properties,
                id: String(f.id || f.properties?.id || f.properties?.name || f.rsmKey || `district-${index}`),
                type: 'District',
                name: f.properties?.name || f.properties?.DIST_EN || f.properties?.ADM1_EN || "Unknown District",
                link: `/districts?name=${encodeURIComponent(f.properties?.name || f.properties?.DIST_EN || f.properties?.ADM1_EN || "Unknown District")}`
              }
            })) as ExtendedFeature[];
            setMapData(processedFeatures);
          } else {
            throw new Error(`Failed to extract or convert valid geometries from TopoJSON layer '${TOPOJSON_OBJECT_KEY}' in ${NEPAL_GEO_URL}. The layer might be empty or malformed.`);
          }
        } else {
          throw new Error(`Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        console.error("HomepageMap: Error in fetchData -", errorMsg, err);
        setFetchError(errorMsg);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchData();
  }, [prefetchedMapData]);

  // Effect to fetch details when a feature is selected
  useEffect(() => {
    if (!selectedFeatureInfo?.feature) {
      return;
    }

    const { id: featureId, type: featureType, name: featureName } = selectedFeatureInfo.feature;

    const currentCacheEntry = detailsCache[featureId];
    const alreadyLoadingFirestore = currentCacheEntry?.isLoadingFirestore;
    const alreadyLoadingAI = currentCacheEntry?.isLoadingAI;
    const hasFirestoreData = !!currentCacheEntry?.description; 
    const hasAIData = !!currentCacheEntry?.aiDescription;

    const needsFirestoreFetch = !hasFirestoreData && !alreadyLoadingFirestore;
    const needsAIFetch = featureType === 'District' && !hasAIData && !alreadyLoadingAI;

    if (!needsFirestoreFetch && !needsAIFetch) {
      return;
    }

    // Update loading states once at the beginning of fetches
    if (needsFirestoreFetch || needsAIFetch) {
      setDetailsCache(prev => {
        const existingEntry = prev[featureId] || {};
        return {
          ...prev,
          [featureId]: {
            ...existingEntry,
            isLoadingFirestore: needsFirestoreFetch ? true : existingEntry.isLoadingFirestore,
            isLoadingAI: needsAIFetch ? true : existingEntry.isLoadingAI,
          }
        };
      });
    }

    // Simulate Firestore Fetch (Replace with actual Firebase calls)
    if (needsFirestoreFetch) {
      console.log(`HomepageMap: Simulating Firestore details fetch for ${featureName} (${featureId})`);
      setTimeout(() => {
        const mockFirestoreDetails = {
          population: selectedFeatureInfo.feature.population || Math.floor(Math.random() * 500000) + 50000,
          description: selectedFeatureInfo.feature.description || 
                       (featureType === 'District' 
                         ? `Discover ${featureName}, known for its unique culture and stunning natural beauty.` 
                         : `Explore ${featureName}, a key city in Nepal offering diverse experiences.`),
        };
        console.log(`HomepageMap: Firestore details received for ${featureName}`, mockFirestoreDetails);
        setDetailsCache(prev => ({
          ...prev,
          [featureId]: { ...prev[featureId], ...mockFirestoreDetails, isLoadingFirestore: false }
        }));
      }, 700);
    }

    if (needsAIFetch && featureType === 'District') {
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
          console.error(`Error fetching AI description for ${featureName}:`, err);
          toast({
            title: "AI Description Error",
            description: `Could not fetch AI insights for ${featureName}. Displaying default.`,
            variant: "default",
          });
          setDetailsCache(prev => ({
            ...prev,
            [featureId]: { ...prev[featureId], aiDescription: null, isLoadingAI: false }
          }));
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeatureInfo, toast]); // REMOVED detailsCache from dependency array


  const handleFeatureClick = useCallback((
    featureProps: Partial<ExtendedProperties['feature']>, // Allow partial to handle direct TopoJSON props
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGGElement>
  ) => {
    event.stopPropagation();
    const { clientX, clientY } = event;

    const districtName = featureProps.name || "Unknown Feature";
    const featureId = String(featureProps.id || (featureProps as any).OBJECTID || districtName + Math.random()); 
    
    const featureData: ExtendedProperties['feature'] = {
      id: featureId,
      name: districtName,
      type: featureType,
      population: featureProps.population,
      description: featureProps.description,
      link: featureProps.link || (featureType === 'District' ? `/districts?name=${encodeURIComponent(districtName)}` : undefined),
      originalProperties: featureType === 'District' ? featureProps : undefined,
    };
    
    console.log(`${featureType} Clicked:`, districtName, "Event clientX:", clientX, "clientY:", clientY, "Feature Data:", featureData);
    setSelectedFeatureInfo({ feature: featureData, clientX, clientY });

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
      
      const infoBoxWidth = 256; // Tailwind w-64
      const infoBoxHeight = 220; // Approximate height for Card with description

      let newLeft = clientX + 15;
      let newTop = clientY + 15;
      let transform = '';

      if (mapContainerRef.current) { // Check if ref is available
        const mapRect = mapContainerRef.current.getBoundingClientRect();
        // Use window.innerWidth/Height for fixed positioning checks
        if (clientX + infoBoxWidth + 15 > window.innerWidth) {
          newLeft = clientX - 15;
          transform = 'translateX(calc(-100% - 30px))'; // Shift left of cursor
        }
        if (clientY + infoBoxHeight + 15 > window.innerHeight) {
          newTop = clientY - infoBoxHeight - 15; // Place above cursor
        }
      }
      
      setInfoBoxStyle({
        left: `${newLeft}px`,
        top: `${newTop}px`,
        visibility: 'visible',
        transform: transform || undefined,
      });
    } else {
      setInfoBoxStyle(prev => ({ ...prev, visibility: 'hidden' }));
    }
  }, [selectedFeatureInfo]);


  let displayErrorMessage = fetchError;
  if (!isLoadingMapGeometry && !mapData && !fetchError) {
    displayErrorMessage = `Map data could not be loaded or is empty. Please ensure '${NEPAL_GEO_URL}' exists in '/public/data/' and is a valid, simplified TopoJSON file containing a layer named '${TOPOJSON_OBJECT_KEY}' with district/province geometries.`;
  }
  
  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">
          {displayErrorMessage || "An unexpected error occurred."}
          {(fetchError?.includes("offline") || fetchError?.includes("Firebase") || fetchError?.includes("Failed to get document")) && (
            <span className="block mt-1 text-xs">This might be due to Firebase configuration issues (check `.env.local` or hosting environment variables) or network problems.</span>
          )}
        </p>
      </div>
    );
  }
  
  if (isLoadingMapGeometry) {
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
      className="relative w-full h-full bg-transparent cursor-default" // Transparent to allow Hero section's bg-card to show
      onClick={handleMapClick} // For closing info box
    >
      {/* Debug state indicator */}
      {/* <div className="fixed top-0 left-0 bg-yellow-300 text-black p-1 text-xs z-[100000]">
        Selected: {selectedFeatureInfo?.feature.name || 'None'} | Cache: {JSON.stringify(currentSelectedCache)}
      </div> */}
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
                const properties = geo.properties as ExtendedProperties['feature'];
                const districtName = properties?.name || "Unknown District";
                const geoIdForSelection = String(geo.rsmKey || properties.id || districtName);
                
                const isSelected =
                  selectedFeatureInfo?.feature.type === 'District' &&
                  selectedFeatureInfo?.feature.id === geoIdForSelection;

                return (
                  <Geography
                    key={geoIdForSelection} 
                    geography={geo}
                    onClick={(event) => handleFeatureClick(properties, 'District', event as unknown as React.MouseEvent<SVGPathElement>)}
                    className={cn(
                      "transition-colors duration-150 ease-in-out outline-none",
                      isSelected 
                        ? "fill-accent stroke-accent-foreground stroke-[1.5px] cursor-default"
                        : "fill-card dark:fill-muted/30 stroke-border dark:stroke-border/50 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 hover:stroke-accent-foreground cursor-pointer"
                    )}
                    aria-label={districtName}
                  />
                );
              })
            }
          </Geographies>
          {/* Geographies for Labels */}
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedProperties['feature'];
                const districtName = properties?.name;
                // @ts-ignore react-simple-maps populates centroid
                const centroid = geo.centroid as [number, number] | undefined;

                if (!centroid || !districtName) return null;
                
                let fontSize = 4;
                if (["Kathmandu", "Kaski", "Morang", "Rupandehi"].includes(districtName)) fontSize = 5;
                
                return (
                  <Marker key={`label-${geo.rsmKey || properties.id || districtName + Math.random()}`} coordinates={centroid}>
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
            const isSelected = selectedFeatureInfo?.feature.type === 'City' && selectedFeatureInfo?.feature.id === city.id;
            let labelFontSize = 5;
            if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) labelFontSize = 6;
            if (city.name === "Kathmandu") labelFontSize = 7;


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
                    r={isSelected ? 5 : 3} 
                    className={cn(
                      isSelected ? "fill-accent stroke-accent-foreground" : "fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground"
                    )}
                    strokeWidth={0.75}
                  />
                  <text
                    textAnchor="middle"
                    y={isSelected ? -8 : -6} 
                    fontSize={labelFontSize}
                    className={cn(
                      "select-none pointer-events-none transition-opacity duration-150 font-semibold",
                      isSelected ? "opacity-100 fill-accent" : "opacity-80 fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent"
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
          style={infoBoxStyle}
          className={cn(
            "fixed p-0 shadow-2xl border border-border bg-card text-card-foreground rounded-lg transition-all duration-200 ease-out z-[9999]",
            "w-56 sm:w-60 md:w-64 flex flex-col overflow-hidden", // Max height handled by scroll area
            infoBoxStyle.visibility === 'visible' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="flex flex-row items-start justify-between p-2.5 space-y-0 border-b bg-muted/30 rounded-t-lg">
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
          <CardContent className="p-2.5 text-xs md:text-sm space-y-1.5 overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent max-h-24">
            {currentSelectedCache?.isLoadingFirestore || (selectedFeatureInfo.feature.type === 'District' && currentSelectedCache?.isLoadingAI) ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Loading details...
              </div>
            ) : (
              <p className="text-muted-foreground line-clamp-4">
                {selectedFeatureInfo.feature.type === 'District' && currentSelectedCache?.aiDescription
                  ? currentSelectedCache.aiDescription
                  : currentSelectedCache?.description || selectedFeatureInfo.feature.description || `Explore ${selectedFeatureInfo.feature.name}, a captivating part of Nepal.`
                }
              </p>
            )}
             {currentSelectedCache?.population && (
                <p className="text-muted-foreground/80 mt-1.5 text-[10px] md:text-xs">Population: {Number(currentSelectedCache.population).toLocaleString()}</p>
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
                Learn More <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
      {/* Loading indicator for details when a feature is selected but details are still fetching */}
      {currentSelectedCache?.isLoadingFirestore && !isLoadingMapGeometry && (
          <div className="absolute bottom-2 right-2 p-1.5 px-2 bg-muted/80 text-muted-foreground text-[10px] rounded-md flex items-center gap-1.5 z-50">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading details...
          </div>
      )}
       {currentSelectedCache?.isLoadingAI && !isLoadingMapGeometry && (
          <div className="absolute bottom-2 right-2 p-1.5 px-2 bg-muted/80 text-muted-foreground text-[10px] rounded-md flex items-center gap-1.5 z-50">
              <Loader2 className="h-3 w-3 animate-spin" />
              AI thinking...
          </div>
      )}
    </div>
  );
}

