
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData, HomepageMapProps, SelectedFeatureDetails, DetailsCacheEntry } from '@/types';
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
import { doc, getDoc } from "firebase/firestore";

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal";

export function HomepageMap({ initialMapData }: HomepageMapProps) {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [displayErrorMessage, setDisplayErrorMessage] = useState<string | null>(null);

  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDetails | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, DetailsCacheEntry>>({});

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [infoBoxStyle, setInfoBoxStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

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
      return { features: null, error: `Invalid TopoJSON: 'objects' property is missing, empty, or not an object. Received: ${JSON.stringify(rawData).substring(0,200)}` };
    }

    const layer = rawData.objects[TOPOJSON_OBJECT_KEY];
    if (!layer || typeof layer !== 'object') {
      return { features: null, error: `Invalid TopoJSON: Layer '${TOPOJSON_OBJECT_KEY}' not found in objects. Available: ${Object.keys(rawData.objects).join(', ')}` };
    }

    if (layer.type !== "GeometryCollection" || !Array.isArray((layer as any).geometries)) {
      return { features: null, error: `Invalid TopoJSON: Layer '${TOPOJSON_OBJECT_KEY}' is not a GeometryCollection or has no 'geometries' array. Type: ${layer.type}` };
    }
    // @ts-ignore
    const geoJsonFeaturesUntyped = topojsonFeature(rawData, layer!).features;

    if (!geoJsonFeaturesUntyped || geoJsonFeaturesUntyped.length === 0) {
      return { features: [], error: `No features found after converting TopoJSON layer '${TOPOJSON_OBJECT_KEY}'.` }; // Return empty array to avoid !mapData being true
    }

    const mappedFeatures = geoJsonFeaturesUntyped.map((feature: any, index: number): ExtendedFeature | null => {
      const props = feature.properties || {};
      const districtName = props.name || props.DIST_EN || props.ADM1_EN || props.DISTRICT || `District ${index + 1}`;
      const featureId = String(feature.id || props.id || props.ID || props.OBJECTID || districtName.replace(/\s+/g, '-').toLowerCase() || `district-${index}`);

      return {
        ...feature,
        rsmKey: featureId, // Use the derived featureId for rsmKey too for consistency
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
      setMapData(null); // Explicitly nullify before attempting to load

      try {
        let dataToProcess: Topology | null = initialMapData || null;

        if (!dataToProcess) {
          const geoRes = await fetch(NEPAL_GEO_URL);
          if (!geoRes.ok) {
            const errorText = await geoRes.text();
            throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
          }
          dataToProcess = await geoRes.json() as Topology;
        }
        
        const processingResult = processRawMapData(dataToProcess);

        if (processingResult.features && processingResult.features.length > 0) {
          setMapData(processingResult.features);
          setFetchError(null); 
        } else {
          const errorMsg = processingResult.error || `No valid map features found or map data is empty after processing ${dataToProcess === initialMapData ? 'initialMapData' : NEPAL_GEO_URL}. Check TopoJSON file and layer key ('${TOPOJSON_OBJECT_KEY}').`;
          console.error("HomepageMap: fetchDataAsync -", errorMsg);
          setFetchError(errorMsg);
          setMapData(null); // Ensure mapData is null if processing fails
        }
      } catch (err) {
        let errorMessage = "Failed to load or process map data.";
        if (err instanceof Error) errorMessage = err.message;

        if (errorMessage.includes("client is offline") || errorMessage.includes("Failed to get document")) {
          errorMessage = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${errorMessage}`;
        }
        console.error("HomepageMap: fetchDataAsync error catch -", errorMessage, err);
        setFetchError(errorMessage);
        setMapData(null); // Ensure mapData is null on any error
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchDataAsync();
  }, [initialMapData, processRawMapData]);


  useEffect(() => {
    const featureId = selectedFeatureInfo?.feature?.id;
    const featureType = selectedFeatureInfo?.feature?.type;
    const featureName = selectedFeatureInfo?.feature?.name;

    if (!featureId || !featureName) {
        setDetailsCache(prev => ({ ...prev, [featureId || '']: { ...prev[featureId || ''], isLoadingFirestore: false, isLoadingAI: false} }) );
        return;
    }

    const cached = detailsCache[featureId];
    let shouldFetchFirestore = !cached || (cached.population === undefined && cached.description === undefined && !cached.isLoadingFirestore);
    let shouldFetchAI = featureType === 'District' && (!cached || (cached.aiDescription === undefined && !cached.isLoadingAI));

    if (shouldFetchFirestore || shouldFetchAI) {
      setDetailsCache(prev => ({
        ...prev,
        [featureId]: { ...prev[featureId], isLoadingFirestore: shouldFetchFirestore, isLoadingAI: shouldFetchAI, error: null }
      }));
    } else {
      return; // All needed data is cached or already loading
    }

    if (shouldFetchFirestore) {
      const collectionName = featureType === 'District' ? 'nepal_provinces_data' : 'nepal_major_cities_data';
      const docRef = doc(db, collectionName, featureId);
      getDoc(docRef).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDetailsCache(prev => ({
            ...prev,
            [featureId]: {
              ...prev[featureId],
              population: data.population,
              description: data.description,
              isLoadingFirestore: false,
            }
          }));
        } else {
          console.warn(`No details found in Firestore for ${featureType} ID: ${featureId}`);
          setDetailsCache(prev => ({ ...prev, [featureId]: { ...prev[featureId], isLoadingFirestore: false } }));
        }
      }).catch(err => {
        console.error(`Error fetching Firestore details for ${featureId}:`, err);
        toast({ title: `Error fetching ${featureType} details`, description: err.message, variant: "destructive" });
        setDetailsCache(prev => ({ ...prev, [featureId]: { ...prev[featureId], isLoadingFirestore: false, error: err.message } }));
      });
    }

    if (shouldFetchAI && featureType === 'District') {
      getDistrictDescription({ districtName: featureName })
        .then(result => {
          setDetailsCache(prev => ({
            ...prev,
            [featureId]: { ...prev[featureId], aiDescription: result.description, isLoadingAI: false }
          }));
        })
        .catch(err => {
          console.error(`Error fetching AI description for ${featureName}:`, err);
          toast({ title: "AI Description Error", description: `Could not fetch AI insights for ${featureName}.`, variant: "default" });
          setDetailsCache(prev => ({ ...prev, [featureId]: { ...prev[featureId], isLoadingAI: false, error: (prev[featureId]?.error || '') + ' AI Error: ' + err.message } }));
        });
    }
  }, [selectedFeatureInfo, toast]); // Removed detailsCache from dependency array


  const handleFeatureClick = useCallback((
    featureProps: ExtendedFeatureProperties,
    eventType: 'District' | 'City',
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    const districtName = featureProps.name;
    const featureId = String(featureProps?.id || featureProps?.rsmKey || districtName.replace(/\s+/g, '-').toLowerCase() + Math.random()); // Ensure unique ID

    console.log(`${eventType} Clicked:`, districtName, "Event clientX:", event.clientX, "clientY:", event.clientY, "Feature ID:", featureId);
    
    const featureData: SelectedFeatureDetails['feature'] = {
      id: featureId,
      name: districtName,
      type: eventType,
      population: featureProps.population,
      description: featureProps.description || `Explore ${districtName}, a diverse place in Nepal.`,
      link: featureProps.link || `/districts?name=${encodeURIComponent(districtName)}`,
    };

    setSelectedFeatureInfo({
      feature: featureData,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, []);


  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    // No need to reset parts of detailsCache here, let the useEffect for selectedFeatureInfo handle it if a new one is selected
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
        
        const infoBoxWidth = 256; // Approx w-64
        const infoBoxHeight = 220; // Approximate height for Card with content
        const offset = 15;

        let newLeft = clientX + offset;
        let newTop = clientY + offset;

        // Adjust if too close to right edge
        if (clientX + infoBoxWidth + offset > window.innerWidth) {
            newLeft = clientX - infoBoxWidth - offset;
        }
        // Adjust if too close to bottom edge
        if (clientY + infoBoxHeight + offset > window.innerHeight) {
            newTop = clientY - infoBoxHeight - offset;
        }
        
        // Clamp to viewport
        newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - infoBoxWidth - 10));
        newTop = Math.max(10, Math.min(newTop, window.innerHeight - infoBoxHeight - 10));

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

  useEffect(() => {
    // This effect ensures the displayErrorMessage is updated whenever fetchError changes.
    // The actual display logic is in the return statement.
    if (fetchError) {
        if (fetchError.includes("client is offline") || fetchError.includes("Failed to get document")) {
            setDisplayErrorMessage(`Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${fetchError}`);
        } else if (fetchError.includes("Invalid TopoJSON") || fetchError.includes("Invalid GeoJSON") || fetchError.includes("layer key") || fetchError.includes("No valid map features")) {
            setDisplayErrorMessage(`Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}').`);
        } else {
            setDisplayErrorMessage(fetchError);
        }
    } else {
        setDisplayErrorMessage(null);
    }
  }, [fetchError]);
  
  if (isLoadingMapGeometry && !initialMapData) {
    return <Skeleton className="aspect-[16/9] w-full h-full bg-muted/50 rounded-xl" />;
  }
  
  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData, "mapData content (if array):", Array.isArray(mapData) ? `Array of ${mapData.length} features` : mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">{displayErrorMessage || "An unknown error occurred, or map data is unavailable. Ensure your TopoJSON file is in public/data/ and correctly formatted, and check console for Firebase errors."}</p>
      </div>
    );
  }
  // Ensure mapData is an array before trying to map over it for Geographies
  if (!Array.isArray(mapData)) {
      console.error("HomepageMap: mapData is not an array after processing. Current mapData:", mapData);
      return <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
          <InfoIcon className="h-10 w-10 mb-2" />
          <p className="font-semibold text-lg mb-1">Map Data Error</p>
          <p className="text-sm">Processed map data is not in the expected array format. Check console.</p>
      </div>;
  }


  const currentSelectedCacheData = selectedFeatureInfo ? detailsCache[selectedFeatureInfo.feature.id] : null;

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full h-full bg-lime-100 dark:bg-green-900/30 cursor-default rounded-xl overflow-hidden"
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
                const geoIdForSelection = String(geo.rsmKey || properties?.id || properties?.name || Math.random());
                const isSelected =
                  selectedFeatureInfo?.feature.type === 'District' &&
                  selectedFeatureInfo?.feature.id === geoIdForSelection;

                return (
                  <Geography
                    key={geoIdForSelection} 
                    geography={geo}
                    onClick={(event) => handleFeatureClick(properties, 'District', event as unknown as React.MouseEvent)}
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
                // @ts-ignore react-simple-maps sometimes adds centroid directly
                const centroid = geo.centroid as [number, number] | undefined; 

                if (!centroid || !districtName ) return null;
                
                let fontSize = 3; 
                let yOffset = 0;
                if (["Kathmandu", "Kaski", "Chitwan", "Morang", "Rupandehi"].includes(districtName.replace(" District", ""))) {
                    fontSize = 3.5;
                }
                 if (districtName === "Kathmandu") fontSize = 4; // For Kathmandu city
                 if (districtName === "Baglung" || districtName === "Myagdi") yOffset = 1.5;


                return (
                  <Marker key={`label-${geo.rsmKey || properties.id || districtName}`} coordinates={centroid}>
                    <text
                      x={0}
                      y={yOffset}
                      fontSize={fontSize}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      className="fill-foreground/70 dark:fill-background/90 pointer-events-none select-none font-medium"
                      style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                    >
                      {districtName.replace(" District", "")}
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
                onClick={(event) => handleFeatureClick(city, 'City', event as unknown as React.MouseEvent)}
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
                      isSelected ? "opacity-100 fill-accent" : "opacity-80 fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent"
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
      {selectedFeatureInfo && (
        <Card
          style={infoBoxStyle}
          className={cn(
            "fixed p-0 w-56 sm:w-60 md:w-64 shadow-2xl border border-border bg-card text-card-foreground rounded-lg transition-all duration-200 ease-out",
             infoBoxStyle.visibility === 'visible' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="flex flex-row items-start justify-between p-2.5 space-y-0 border-b">
            <CardTitle className="text-base md:text-lg font-bold leading-tight flex items-center text-primary">
              <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
              {selectedFeatureInfo.feature.name || "Details"}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0" onClick={handleCloseInfoBox} aria-label="Close info box">
              <XIcon className="w-3.5 h-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-2.5 text-xs md:text-sm space-y-1.5 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            {currentSelectedCacheData?.isLoadingAI || currentSelectedCacheData?.isLoadingFirestore ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Loading description...
              </div>
            ) : currentSelectedCacheData?.error && (!currentSelectedCacheData.aiDescription && !currentSelectedCacheData.description) ? (
                 <p className="text-destructive/90 italic text-[10px] md:text-xs">
                    AI description error. {selectedFeatureInfo.feature.description || `Explore ${selectedFeatureInfo.feature.name}.`}
                 </p>
            ) : (
              <p className="text-muted-foreground line-clamp-3">
                {currentSelectedCacheData?.aiDescription || currentSelectedCacheData?.description || selectedFeatureInfo.feature.description || `Explore ${selectedFeatureInfo.feature.name}, a captivating part of Nepal.`}
              </p>
            )}
             {currentSelectedCacheData?.population && (
                <p className="text-muted-foreground/80 mt-1 text-[10px] md:text-[11px]">Population: {Number(currentSelectedCacheData.population).toLocaleString()}</p>
            )}
          </CardContent>
          {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-2.5 border-t pt-2 mt-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs md:text-sm text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
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
      {/* Loading indicator for AI/Firestore details (if a feature is selected but its details are still fetching) */}
    {(currentSelectedCacheData?.isLoadingAI || currentSelectedCacheData?.isLoadingFirestore) && !isLoadingMapGeometry && (
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
