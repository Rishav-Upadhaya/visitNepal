
"use client";

import type { ExtendedFeature, ExtendedFeatureProperties, HomepageMapProps, CityMapData, SelectedFeatureDetails } from '@/types';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
// Firebase import (db) will be used for on-demand fetching
// import { db } from '@/lib/firebase';
// import { doc, getDoc } from 'firebase/firestore';


const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // Key in TopoJSON objects holding the district/province geometries

interface InfoBoxStyle {
  left: string;
  top: string;
  visibility: 'visible' | 'hidden';
  transform?: string;
}

// For storing details fetched on demand
interface CachedDetails extends Partial<Pick<SelectedFeatureDetails, 'population' | 'description' | 'aiDescription'>> {
  isLoadingFirestore?: boolean;
  isLoadingAI?: boolean;
}

export function HomepageMap({ initialMapData: prefetchedMapData }: HomepageMapProps) {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<{ feature: SelectedFeatureDetails; clientX: number; clientY: number; } | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, CachedDetails>>({});
  
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

  // Effect for fetching and processing TopoJSON map data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setMapData(null);

      if (prefetchedMapData) {
        console.log("HomepageMap: Using prefetched map data.");
        try {
          if (!prefetchedMapData.objects || !prefetchedMapData.objects[TOPOJSON_OBJECT_KEY]) {
            throw new Error(`Prefetched TopoJSON is missing 'objects.${TOPOJSON_OBJECT_KEY}'.`);
          }
          const layer = prefetchedMapData.objects[TOPOJSON_OBJECT_KEY];
          // @ts-ignore // topojson-client types can be tricky with specific TopoJSON structures
          const geoJsonFeatures = topojsonFeature(prefetchedMapData, layer).features as ExtendedFeature[];
          
          if (geoJsonFeatures && geoJsonFeatures.length > 0) {
            setMapData(geoJsonFeatures.map(f => ({
              ...f,
              properties: {
                ...f.properties,
                id: String(f.id || f.properties?.id || f.properties?.name || f.rsmKey || Math.random()),
                type: 'District', // Assuming these are districts
                name: f.properties?.name || f.properties?.DIST_EN || f.properties?.ADM1_EN || "Unknown District",
                link: `/districts?name=${encodeURIComponent(f.properties?.name || f.properties?.DIST_EN || f.properties?.ADM1_EN || "Unknown District")}`
              }
            })));
          } else {
            throw new Error("Failed to extract features from prefetched TopoJSON.");
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "An unknown error occurred while processing prefetched map data.";
          console.error("HomepageMap: Error processing prefetched map data -", errorMsg, err);
          setFetchError(`Map Error: Could not process prefetched map data. ${errorMsg}`);
          setMapData(null);
        } finally {
          setIsLoadingMapGeometry(false);
        }
        return;
      }
      
      console.log("HomepageMap: Prefetched map data not available, fetching from URL:", NEPAL_GEO_URL);
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`);
        }
        const rawMapData: Topology = await geoRes.json();
        console.log("HomepageMap: Raw map data fetched successfully. Objects keys:", Object.keys(rawMapData.objects || {}));

        if (rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          // @ts-ignore
          const geoJsonFeatures = topojsonFeature(rawMapData, layer).features as ExtendedFeature[];
          
          if (geoJsonFeatures && geoJsonFeatures.length > 0) {
             setMapData(geoJsonFeatures.map(f => ({
              ...f,
              properties: {
                ...f.properties,
                id: String(f.id || f.properties?.id || f.properties?.name || f.rsmKey || Math.random()),
                type: 'District',
                name: f.properties?.name || f.properties?.DIST_EN || f.properties?.ADM1_EN || "Unknown District",
                link: `/districts?name=${encodeURIComponent(f.properties?.name || f.properties?.DIST_EN || f.properties?.ADM1_EN || "Unknown District")}`
              }
            })));
          } else {
            throw new Error(`Failed to extract features from TopoJSON layer '${TOPOJSON_OBJECT_KEY}'.`);
          }
        } else {
          throw new Error(`Invalid TopoJSON structure: Layer object for key '${TOPOJSON_OBJECT_KEY}' is missing.`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        console.error("HomepageMap: Error in fetchData -", errorMsg, err);
        setFetchError(`Map Error: ${errorMsg}. Please ensure '${NEPAL_GEO_URL}' is valid and accessible.`);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchData();
  }, [prefetchedMapData]);


  // Effect to fetch details when a feature is selected
  useEffect(() => {
    if (selectedFeatureInfo?.feature) {
      const featureId = selectedFeatureInfo.feature.id;
      const featureType = selectedFeatureInfo.feature.type;
      const featureName = selectedFeatureInfo.feature.name;

      // Check cache first
      if (detailsCache[featureId] && (detailsCache[featureId].description || detailsCache[featureId].aiDescription)) {
        // Details already in cache, no need to fetch unless specifically forced
        // For AI description, we might want to re-fetch if it wasn't loaded successfully before
        if (featureType === 'District' && !detailsCache[featureId].aiDescription && !detailsCache[featureId].isLoadingAI) {
          // Fallthrough to fetch AI description
        } else {
          return; // Already have what we need or it's loading
        }
      }

      setDetailsCache(prev => ({
        ...prev,
        [featureId]: { ...prev[featureId], isLoadingFirestore: true, isLoadingAI: featureType === 'District' }
      }));

      // Simulate Firestore fetch for details (population, description)
      // In a real app, replace this with actual Firestore calls:
      // e.g., const docRef = doc(db, featureType === 'District' ? 'nepal_provinces_data' : 'nepal_major_cities_data', featureId);
      // const docSnap = await getDoc(docRef);
      // if (docSnap.exists()) { ... }
      setTimeout(() => { // Simulating async fetch
        const mockFirestoreDetails = {
          population: selectedFeatureInfo.feature.population || Math.floor(Math.random() * 1000000) + 50000,
          description: selectedFeatureInfo.feature.description || (featureType === 'District' ? `Explore the unique landscapes and culture of ${featureName}.` : `Discover ${featureName}, a vibrant city in Nepal.`)
        };
        
        setDetailsCache(prev => ({
          ...prev,
          [featureId]: { ...prev[featureId], ...mockFirestoreDetails, isLoadingFirestore: false }
        }));
      }, 500);


      if (featureType === 'District') {
        getDistrictDescription({ districtName: featureName })
          .then(result => {
            setDetailsCache(prev => ({
              ...prev,
              [featureId]: { ...prev[featureId], aiDescription: result.description, isLoadingAI: false }
            }));
          })
          .catch(err => {
            console.error(`Error fetching AI description for ${featureName}:`, err);
            toast({
              title: "AI Description Error",
              description: `Could not fetch AI insights for ${featureName}.`,
              variant: "destructive",
            });
            setDetailsCache(prev => ({
              ...prev,
              [featureId]: { ...prev[featureId], aiDescription: null, isLoadingAI: false }
            }));
          });
      }
    }
  }, [selectedFeatureInfo, detailsCache, toast]);


  // Effect to position the info box
  useEffect(() => {
    if (selectedFeatureInfo && mapContainerRef.current) {
      const { clientX, clientY } = selectedFeatureInfo;
      const mapRect = mapContainerRef.current.getBoundingClientRect();
      
      const infoBoxWidth = 256; // Tailwind w-64
      const infoBoxHeight = 200; // Approximate height, adjust as needed

      let newLeft = clientX + 15; // Offset from cursor
      let newTop = clientY + 15;
      let transform = '';

      // Adjust if too close to right edge of viewport
      if (clientX + infoBoxWidth + 15 > window.innerWidth) {
        newLeft = clientX - 15;
        transform = 'translateX(-100%)';
      }

      // Adjust if too close to bottom edge of viewport
      if (clientY + infoBoxHeight + 15 > window.innerHeight) {
        newTop = clientY - 15; // Place above cursor
        transform += transform ? ' translateY(-100%)' : 'translateY(-100%)';
      } else {
         transform += transform ? ' translateY(0%)' : 'translateY(0%)'; // Explicitly set for consistency
      }
      
      // Ensure it doesn't go off the top or left
      if (newTop < 5) newTop = 5; // Minimum 5px from top
      if (newLeft < 5 && !transform.includes('translateX(-100%)')) newLeft = 5;
      if (newLeft - infoBoxWidth < 5 && transform.includes('translateX(-100%)')) newLeft = 5 + infoBoxWidth;


      setInfoBoxStyle({
        left: `${newLeft}px`,
        top: `${newTop}px`,
        visibility: 'visible',
        transform: transform.trim() || undefined,
      });
    } else {
      setInfoBoxStyle({ visibility: 'hidden', left: '0px', top: '0px' });
    }
  }, [selectedFeatureInfo]);


  const handleFeatureClick = useCallback((
    featureProps: ExtendedFeatureProperties,
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGGElement>
  ) => {
    event.stopPropagation(); // Prevent map click from closing info box immediately
    const { clientX, clientY } = event;

    const featureId = String(featureProps.id || featureProps.rsmKey || featureProps.name); 
    const displayName = featureProps.name || "Unknown Feature";
    
    console.log(`${featureType} Clicked:`, displayName, "clientX:", clientX, "clientY:", clientY, "Feature ID:", featureId);
    
    setSelectedFeatureInfo({
      feature: {
        id: featureId,
        name: displayName,
        type: featureType,
        link: featureProps.link || (featureType === 'District' ? `/districts?name=${encodeURIComponent(displayName)}` : undefined),
        population: featureProps.population,
        description: featureProps.description, // Initial description from TopoJSON/majorCities
        originalProperties: featureType === 'District' ? featureProps : undefined,
      },
      clientX,
      clientY,
    });
  }, []);


  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);
  
  const handleMapClick = useCallback(() => {
      if (selectedFeatureInfo) { // Only close if an info box is open
          handleCloseInfoBox();
      }
  },[selectedFeatureInfo, handleCloseInfoBox]);


  let displayErrorMessage = fetchError;
  if (!isLoadingMapGeometry && !mapData && !fetchError) {
    displayErrorMessage = `Map data could not be loaded or is empty. Please ensure '${NEPAL_GEO_URL}' exists in '/public/data/' and is a valid, simplified TopoJSON file containing a layer named '${TOPOJSON_OBJECT_KEY}' with district/province geometries.`;
  }
  
  if (displayErrorMessage || !mapData) {
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">
          {displayErrorMessage || "An unexpected error occurred while loading map data."}
          {(fetchError?.includes("offline") || fetchError?.includes("Firebase") || fetchError?.includes("Failed to get document")) && (
            <span className="block mt-1 text-xs">This might be due to Firebase configuration issues (check `.env.local` or hosting environment variables) or network problems.</span>
          )}
        </p>
      </div>
    );
  }
  
  if (isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full h-full bg-muted/10 rounded-xl flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Loading Interactive Map of Nepal...</p>
      </div>
    );
  }

  const currentSelectedCache = selectedFeatureInfo ? detailsCache[selectedFeatureInfo.feature.id] : null;

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full h-full bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={handleMapClick}
    >
      {/* Debug Top Level State Info */}
      {/* <div className="fixed top-2 left-2 bg-yellow-200 text-black p-2 z-[100000] text-xs">
        DEBUG: Selected: {selectedFeatureInfo?.feature.name || "None"}
        <br />
        Coords: X:{selectedFeatureInfo?.clientX}, Y:{selectedFeatureInfo?.clientY}
        <br/>
        Style: L:{infoBoxStyle.left}, T:{infoBoxStyle.top}, V:{infoBoxStyle.visibility}
      </div> */}
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
          {/* Geographies for Districts */}
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedFeatureProperties; 
                const districtName = properties?.name || "Unknown District";
                const geoIdForSelection = String(geo.rsmKey || properties.id || districtName);
                
                const isSelected =
                  selectedFeatureInfo?.feature.type === 'District' &&
                  selectedFeatureInfo?.feature.id === geoIdForSelection;

                return (
                  <Geography
                    key={geo.rsmKey || properties.id || districtName + Math.random()} 
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
                const properties = geo.properties as ExtendedFeatureProperties;
                const districtName = properties?.name;
                const centroid = (geo as any).centroid as [number, number] | undefined; // geo.centroid is populated by react-simple-maps

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
            if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) labelFontSize = 7;
            if (city.name === "Kathmandu") labelFontSize = 9;

            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                onClick={(event) => handleFeatureClick(city as unknown as ExtendedFeatureProperties, 'City', event as unknown as React.MouseEvent<SVGGElement>)}
              >
                 <g
                  className={cn(
                    "transition-all group cursor-pointer",
                    isSelected ? "text-accent" : "text-primary hover:text-accent/80"
                  )}
                >
                  <circle
                    r={isSelected ? 6 : 4} 
                    className={cn(
                      isSelected ? "fill-accent stroke-accent-foreground" : "fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground"
                    )}
                    strokeWidth={0.75}
                  />
                  <text
                    textAnchor="middle"
                    y={isSelected ? -9 : -7} 
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

      {selectedFeatureInfo && (
        <Card
          style={infoBoxStyle}
          className={cn(
            "fixed p-0 shadow-2xl border border-border bg-card text-card-foreground rounded-lg transition-all duration-200 ease-out text-xs",
            "w-56 sm:w-60 md:w-64 max-h-[250px] flex flex-col overflow-hidden z-[60]" // ensure z-index is high
          )}
          onClick={(e) => e.stopPropagation()} // Prevent map click from closing it
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
          <CardContent className="p-2.5 text-xs md:text-sm space-y-1.5 overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent max-h-28">
            {currentSelectedCache?.isLoadingFirestore || (selectedFeatureInfo.feature.type === 'District' && currentSelectedCache?.isLoadingAI) ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Loading details...
              </div>
            ) : (
              <>
                <p className="text-muted-foreground line-clamp-4">
                  {selectedFeatureInfo.feature.type === 'District' && currentSelectedCache?.aiDescription
                    ? currentSelectedCache.aiDescription
                    : currentSelectedCache?.description || selectedFeatureInfo.feature.description || `Explore ${selectedFeatureInfo.feature.name}, a notable area in Nepal.`
                  }
                </p>
                {currentSelectedCache?.population && (
                    <p className="text-muted-foreground/80 mt-1.5 text-[10px] md:text-xs">Population: {Number(currentSelectedCache.population).toLocaleString()}</p>
                )}
              </>
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
      {(currentSelectedCache?.isLoadingFirestore || (selectedFeatureInfo?.feature.type === 'District' && currentSelectedCache?.isLoadingAI)) && !isLoadingMapGeometry && (
          <div className="absolute bottom-2 right-2 p-1.5 px-2 bg-muted/80 text-muted-foreground text-[10px] rounded-md flex items-center gap-1.5 z-50">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>Fetching details...</span>
          </div>
      )}
    </div>
  );
}
