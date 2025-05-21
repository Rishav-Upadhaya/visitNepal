
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData, HomepageMapProps, SelectedFeatureDetails, DetailsCacheEntry, ExtendedFeatureProperties } from '@/types';
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
// No direct Firebase db import needed here anymore for initial details
// import { db } from '@/lib/firebase';
// import { doc, getDoc } from 'firebase/firestore';

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // The key in TopoJSON objects that holds the geometry collection

export function HomepageMap({ initialMapData }: HomepageMapProps) {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [displayErrorMessage, setDisplayErrorMessage] = useState<string | null>(null);

  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDetails | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, DetailsCacheEntry>>({});
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
      return { features: null, error: `Invalid TopoJSON: 'objects' property is missing or empty. Received: ${JSON.stringify(rawData).substring(0, 200)}` };
    }

    const layer = rawData.objects[TOPOJSON_OBJECT_KEY];
    if (!layer || typeof layer !== 'object') {
      return { features: null, error: `Invalid TopoJSON: Layer '${TOPOJSON_OBJECT_KEY}' not found in objects. Available: ${Object.keys(rawData.objects).join(', ')}` };
    }

    // @ts-ignore topojson-client types might not perfectly match all TopoJSON variations
    const geoJsonCollection = topojsonFeature(rawData, layer);

    if (geoJsonCollection.type !== "FeatureCollection" || !Array.isArray(geoJsonCollection.features) || geoJsonCollection.features.length === 0) {
        return { features: [], error: `No features found or layer '${TOPOJSON_OBJECT_KEY}' is not a FeatureCollection after converting TopoJSON.` };
    }
    
    const mappedFeatures = geoJsonCollection.features.map((feature: any, index: number): ExtendedFeature | null => {
      const props = feature.properties || {};
      const districtName = props.name || props.DIST_EN || props.ADM1_EN || `District ${index + 1}`;
      const featureId = String(props.id || props.OBJECTID || props.DIST_EN || props.name || `district-${index}`);

      return {
        ...feature,
        id: featureId,
        properties: {
          ...props,
          id: featureId,
          name: districtName,
          type: 'District',
          link: `/districts?name=${encodeURIComponent(districtName)}`,
          description: props.description || `Explore ${districtName}, a notable district in Nepal.`
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
      setMapData(null); // Clear previous map data

      try {
        let dataToProcess: Topology | null = initialMapData || null;

        if (!dataToProcess) {
          const geoRes = await fetch(NEPAL_GEO_URL);
          if (!geoRes.ok) {
            const errorText = await geoRes.text();
            throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0,300)}`);
          }
          dataToProcess = await geoRes.json() as Topology;
          console.log("HomepageMap: TopoJSON fetched from URL successfully. Parsed data sample:", JSON.stringify(dataToProcess, null, 2).substring(0, 300) + "...");
        } else {
           console.log("HomepageMap: Using pre-fetched initialMapData. Sample:", JSON.stringify(dataToProcess, null, 2).substring(0, 300) + "...");
        }
        
        const processingResult = processRawMapData(dataToProcess);

        if (processingResult.features && processingResult.features.length > 0) {
            setMapData(processingResult.features);
            setFetchError(null); 
        } else {
            const errorMsg = processingResult.error || `No valid map features found or map data is empty after processing. Check TopoJSON file ('${NEPAL_GEO_URL}') and layer key ('${TOPOJSON_OBJECT_KEY}').`;
            console.error("HomepageMap: fetchDataAsync -", errorMsg);
            setFetchError(errorMsg);
            setMapData(null);
        }
      } catch (err) {
        let errorMessage = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        console.error("HomepageMap: fetchDataAsync error catch -", errorMessage, err);
        setFetchError(errorMessage);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchDataAsync();
  }, [initialMapData, processRawMapData]);


  useEffect(() => {
    if (fetchError) {
      let specificMessage = fetchError;
      if (fetchError.includes("client is offline") || fetchError.includes("Failed to get document")) {
        specificMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
      } else if (fetchError.includes("Invalid TopoJSON") || fetchError.includes("Invalid GeoJSON") || fetchError.includes("layer key") || fetchError.includes("No valid map features")) {
        specificMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}'). Original error: ${fetchError}`;
      } else if (fetchError.includes("404")) {
         specificMessage = `Map Error: The map data file (${NEPAL_GEO_URL}) was not found. Please ensure it exists in the public/data directory.`;
      }
      setDisplayErrorMessage(specificMessage);
    } else {
      setDisplayErrorMessage(null);
    }
  }, [fetchError]);


  // Fetch details when a feature is selected and not already in cache
  useEffect(() => {
    if (!selectedFeatureInfo || !selectedFeatureInfo.feature) {
      setIsFetchingDescription(false);
      return;
    }

    const { id: featureId, name: featureName, type: featureType } = selectedFeatureInfo.feature;
    const cachedEntry = detailsCache[featureId];

    // Determine if AI description needs fetching
    const shouldFetchAI = featureType === 'District' && (!cachedEntry || (cachedEntry.aiDescription === undefined && !cachedEntry.isLoadingAI && !cachedEntry.aiError));

    if (shouldFetchAI) {
      console.log(`Fetching AI description for ${featureName} (ID: ${featureId})`);
      setDetailsCache(prev => ({
        ...prev,
        [featureId]: { ...prev[featureId], isLoadingAI: true, aiError: null }
      }));
      setIsFetchingDescription(true);

      getDistrictDescription({ districtName: featureName })
        .then(result => {
          setDetailsCache(prev => ({
            ...prev,
            [featureId]: { ...prev[featureId], aiDescription: result.description, isLoadingAI: false }
          }));
          setIsFetchingDescription(false);
        })
        .catch(err => {
          console.error(`Error fetching AI description for ${featureName}:`, err);
          toast({ title: "AI Description Error", description: `Could not fetch AI insights for ${featureName}.`, variant: "default" });
          setDetailsCache(prev => ({ ...prev, [featureId]: { ...prev[featureId], isLoadingAI: false, aiError: err.message } }));
          setIsFetchingDescription(false);
        });
    } else if (featureType === 'District' && cachedEntry?.aiDescription !== undefined) {
      setIsFetchingDescription(false); // Already have it or errored previously
    } else {
      setIsFetchingDescription(false); // Not a district or no need to fetch AI
    }

    // Firestore fetching (population/description) is removed for now, as per removing Firebase dependency for this component.
    // If you re-add it, the logic should be similar to the AI description fetching part.
    // Ensure any `isLoadingFirestore` states are also reset if you don't fetch.

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeatureInfo, toast]); // Removed detailsCache from dependency array to prevent loops

  const handleFeatureClick = useCallback((featureProps: ExtendedFeatureProperties, geo: any, event: React.MouseEvent) => {
    event.stopPropagation();
    const { clientX, clientY } = event;
    const localDisplayName = featureProps?.name || 'Unknown District';
    const localFeatureId = String(geo?.rsmKey || featureProps?.id || featureProps?.name || localDisplayName + Math.random());

    console.log(`${featureProps.type || 'District'} Clicked:`, localDisplayName, "Event clientX:", clientX, "clientY:", clientY, "Feature ID:", localFeatureId);
    
    setSelectedFeatureInfo({
      feature: {
        id: localFeatureId,
        name: localDisplayName,
        type: featureProps.type || 'District',
        description: featureProps.description,
        link: featureProps.link || `/districts?name=${encodeURIComponent(localDisplayName)}`,
        population: featureProps.population,
      },
      clientX: clientX,
      clientY: clientY,
    });
  }, []);

  const handleCityClick = useCallback((city: CityMapData, event: React.MouseEvent) => {
    event.stopPropagation();
    const { clientX, clientY } = event;
    console.log("City marker clicked:", city.name, "Event clientX:", clientX, "clientY:", clientY);
    setSelectedFeatureInfo({
      feature: {
        id: city.id,
        name: city.name,
        type: 'City',
        population: city.population,
        description: city.description,
        link: city.link,
      },
      clientX: clientX,
      clientY: clientY,
    });
  }, []);

  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    setIsFetchingDescription(false);
    // If you had other states like aiDescription directly on component, reset them here too
  }, []);
  
  const handleMapClick = useCallback(() => {
     if (selectedFeatureInfo) { 
      handleCloseInfoBox();
    }
  },[selectedFeatureInfo, handleCloseInfoBox]);

   useEffect(() => {
    if (selectedFeatureInfo && mapContainerRef.current) {
        const { clientX, clientY } = selectedFeatureInfo;
        const mapRect = mapContainerRef.current.getBoundingClientRect();
        
        const INFO_BOX_WIDTH = 256; // w-64
        const INFO_BOX_HEIGHT_ESTIMATE = 250; // Approximate height, adjust as needed
        const OFFSET = 15;

        let newLeft = clientX + OFFSET;
        let newTop = clientY + OFFSET;

        // Adjust if info box would go off the right edge of the viewport
        if (clientX + INFO_BOX_WIDTH + OFFSET > window.innerWidth) {
            newLeft = clientX - INFO_BOX_WIDTH - OFFSET;
        }
        // Adjust if info box would go off the bottom edge of the viewport
        if (clientY + INFO_BOX_HEIGHT_ESTIMATE + OFFSET > window.innerHeight) {
            newTop = clientY - INFO_BOX_HEIGHT_ESTIMATE - OFFSET;
        }
        
        newLeft = Math.max(10, newLeft); // Ensure it's not off-left
        newTop = Math.max(10, newTop); // Ensure it's not off-top

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


  // Loading and Error States
  if (isLoadingMapGeometry && !initialMapData) { // Show skeleton if still fetching initial map JSON AND no preloaded data
    return <Skeleton className="aspect-[16/9] w-full h-full bg-muted/50 rounded-xl" />;
  }
  
  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData, "Actual mapData:", mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable or invalid. Please ensure the TopoJSON file is correctly placed in public/data and properly structured with a 'nepal' layer."}</p>
      </div>
    );
  }
   if (!Array.isArray(mapData) || mapData.length === 0) {
      console.error("HomepageMap: mapData is not a valid non-empty array. Actual mapData:", mapData);
       return (
         <div className="aspect-[16/9] w-full bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex flex-col items-center justify-center text-yellow-700 dark:text-yellow-300 p-4 text-center">
           <Globe className="h-10 w-10 mb-2" />
           <p className="font-semibold text-lg mb-1">No Map Data</p>
           <p className="text-sm">No geographical features to display. Check TopoJSON processing and file content.</p>
         </div>
       );
   }

  const currentSelectedCacheData = selectedFeatureInfo ? detailsCache[selectedFeatureInfo.feature.id] : null;

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full h-full bg-lime-100 dark:bg-green-900/30 cursor-default rounded-xl overflow-hidden" // Added rounded-xl and overflow-hidden
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
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedFeatureProperties;
                const geoIdForSelection = String(geo.rsmKey || properties.id || properties.name || Math.random());
                const isSelected =
                  selectedFeatureInfo?.feature.type === 'District' &&
                  selectedFeatureInfo?.feature.id === geoIdForSelection;

                return (
                  <Geography
                    key={geoIdForSelection} 
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(properties, geo, event)}
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
          {/* Labels for Provinces/Districts */}
           <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedFeatureProperties;
                const districtName = properties?.name;
                // @ts-ignore react-simple-maps might add centroid directly if geometry is simple
                const centroid = (geo as any).centroid as [number, number] | undefined || (() => {
                    // Basic centroid calculation if not provided by rsm (only for simple polygons for now)
                    if (geo.geometry && geo.geometry.type === 'Polygon' && geo.geometry.coordinates && geo.geometry.coordinates[0]) {
                        const coords = geo.geometry.coordinates[0];
                        let x = 0, y = 0, i = 0, j = coords.length - 1;
                        for (; i < coords.length; j = i++) {
                            x += (coords[j][0] + coords[i][0]) * (coords[j][1] * coords[i][0] - coords[j][0] * coords[i][1]);
                            y += (coords[j][1] + coords[i][1]) * (coords[j][1] * coords[i][0] - coords[j][0] * coords[i][1]);
                        }
                        const area = 3 * (coords[j][1] * coords[i][0] - coords[j][0] * coords[i][1]);
                        if (area === 0) return [coords[0][0], coords[0][1]]; // fallback to first point for degenerate polygons
                        return [x / area, y / area];
                    }
                    return undefined;
                })();


                if (!centroid || !districtName ) return null;
                
                let fontSize = 4;
                if (["Kathmandu", "Kaski", "Chitwan", "Morang", "Rupandehi"].includes(districtName)) {
                    fontSize = 4.5;
                }
                if (districtName === "Kathmandu") fontSize = 5;
                
                return (
                  <Marker key={`label-${geoIdForSelection}`} coordinates={centroid}>
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
            let labelFontSize = 5;
            if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) labelFontSize = 6;
            if (city.name === "Kathmandu") labelFontSize = 7;
            

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
                    r={isSelected ? 4 : 3} 
                    className={cn(
                      isSelected ? "fill-accent stroke-accent-foreground" : "fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground"
                    )}
                    strokeWidth={0.75}
                  />
                  <text
                    textAnchor="middle"
                    y={isSelected ? -7 : -6} 
                    fontSize={labelFontSize}
                    className={cn(
                      "select-none pointer-events-none transition-opacity duration-150 font-semibold",
                       isSelected ? "opacity-100 fill-accent" : "fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent"
                    )}
                     style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
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
      {selectedFeatureInfo && selectedFeatureInfo.feature && (
        <Card
          style={infoBoxStyle}
          className={cn(
            "fixed p-0 w-56 sm:w-60 md:w-64 shadow-2xl border border-border bg-card text-card-foreground rounded-lg transition-all duration-200 ease-out",
             infoBoxStyle.visibility === 'visible' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="flex flex-row items-start justify-between p-2.5 space-y-0 border-b">
            <CardTitle className="text-sm md:text-base font-bold leading-tight flex items-center text-primary">
              <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-primary/80" />
              {selectedFeatureInfo.feature.name || "Details"}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0" onClick={handleCloseInfoBox} aria-label="Close info box">
              <XIcon className="w-3.5 h-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-2.5 text-xs md:text-sm space-y-1.5 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Generating description...
              </div>
            )}
            {(!isFetchingDescription || selectedFeatureInfo.feature.type !== 'District') && (
                 <p className="text-muted-foreground line-clamp-3">
                 {selectedFeatureInfo.feature.type === 'District'
                   ? detailsCache[selectedFeatureInfo.feature.id]?.aiDescription || selectedFeatureInfo.feature.description || `Explore ${selectedFeatureInfo.feature.name}, a diverse district in Nepal.`
                   : selectedFeatureInfo.feature.description || `Discover ${selectedFeatureInfo.feature.name}.`}
                  {detailsCache[selectedFeatureInfo.feature.id]?.aiError && selectedFeatureInfo.feature.type === 'District' && <span className="text-destructive/80 text-[10px] block mt-1">AI description unavailable.</span>}
               </p>
            )}
            {detailsCache[selectedFeatureInfo.feature.id]?.population && (
                <p className="text-muted-foreground/80 mt-1 text-[10px] md:text-[11px]">Population: {Number(detailsCache[selectedFeatureInfo.feature.id]!.population).toLocaleString()}</p>
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
                Learn More <ExternalLink className="ml-1.5 h-3 w-3" /> 
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
       {/* Loading indicator for details fetch (separate from map geometry loading) */}
       {(detailsCache[selectedFeatureInfo?.feature.id || '']?.isLoadingFirestore || detailsCache[selectedFeatureInfo?.feature.id || '']?.isLoadingAI) && !isLoadingMapGeometry && (
          <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading details...
          </div>
      )}
    </div>
  );
}

// Helper for a very basic centroid for label placement, only if not provided
const getCentroid = (geo: any): [number, number] | undefined => {
    if (geo && (geo as any).centroid) return (geo as any).centroid; // Use rsmKey's centroid if available

    if (geo && geo.geometry) {
        const { type, coordinates } = geo.geometry;
        if (type === 'Polygon' && coordinates && coordinates[0] && coordinates[0].length > 0) {
            let x = 0;
            let y = 0;
            let signedArea = 0;
            const path = coordinates[0];
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
            if (signedArea === 0) return [path[0][0], path[0][1]]; // Fallback
            signedArea *= 0.5;
            x /= (6 * signedArea);
            y /= (6 * signedArea);
            return [x, y];
        } else if (type === 'MultiPolygon' && coordinates && coordinates[0] && coordinates[0][0] && coordinates[0][0].length > 0) {
             // For MultiPolygon, a simple centroid of the first polygon's first ring for simplicity
            let x = 0;
            let y = 0;
            let signedArea = 0;
            const path = coordinates[0][0]; // Take the first polygon's first ring
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
            if (signedArea === 0) return [path[0][0], path[0][1]];
            signedArea *= 0.5;
            x /= (6 * signedArea);
            y /= (6 * signedArea);
            return [x,y];
        }
    }
    return undefined;
};
const geoIdForSelection = "someUniqueId"; // This needs to be properly defined in the map loop for labels.

