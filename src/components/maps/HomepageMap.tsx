
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData, ExtendedProperties } from '@/types'; // Adjusted type import
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology } from 'topojson-client';
import { getDistrictDescription, type GetDistrictDescriptionOutput } from '@/ai/flows/get-district-description-flow';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase'; // Assuming db is correctly configured
import { doc, getDoc } from 'firebase/firestore';


const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // Key for the layer in your TopoJSON

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
      setMapData(null); // Reset map data on new fetch attempt
      console.log("HomepageMap: Starting to fetch map data from:", NEPAL_GEO_URL);

      if (!db) {
        const errorMsg = "Firebase 'db' instance is not available. Check Firebase initialization and configuration in src/lib/firebase.ts. Map details cannot be fetched.";
        console.error("HomepageMap:", errorMsg);
        setFetchError(errorMsg);
        setIsLoadingMapGeometry(false);
        return;
      }

      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`;
          console.error("HomepageMap: Fetch Error -", errorMsg);
          throw new Error(errorMsg);
        }
        const rawMapData: Topology | any = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON fetched successfully. Keys in objects:", rawMapData.objects ? Object.keys(rawMapData.objects) : "No objects property");

        if (rawMapData && typeof rawMapData === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries) && layer.geometries.length > 0) {
            const geoJsonFeatures = topojsonFeature(rawMapData, layer!).features as ExtendedFeature[];
            
            if (geoJsonFeatures && geoJsonFeatures.length > 0) {
              const processedFeatures = await Promise.all(geoJsonFeatures.map(async f => {
                const props = f.properties as any;
                const districtName = props?.name || props?.DIST_EN || props?.ADM1_EN || "Unknown District";
                const featureId = String(f.id || props?.id || districtName + Math.random().toString(36).substring(2));
                
                let firestoreDetails: { description?: string, population?: number, link?: string } = {};
                try {
                  if (db) { // Check if db is defined before using it
                    const docRef = doc(db, "nepal_provinces_data", districtName.toLowerCase().replace(/\s+/g, '-')); // Example: use district name as doc ID
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                      firestoreDetails = docSnap.data() as { description?: string, population?: number, link?: string };
                    }
                  }
                } catch (dbError) {
                  console.warn(`HomepageMap: Failed to fetch details for ${districtName} from Firestore:`, dbError);
                }

                return {
                  ...f,
                  id: featureId,
                  properties: {
                    ...props,
                    id: featureId,
                    name: districtName,
                    type: 'District',
                    description: firestoreDetails.description || props?.description || `Discover ${districtName}, a unique district in Nepal.`,
                    link: firestoreDetails.link || props?.link || `/districts?name=${encodeURIComponent(districtName)}`,
                    population: firestoreDetails.population || props?.population
                  }
                };
              }));
              setMapData(processedFeatures);
              setFetchError(null);
            } else {
              const errorMsg = `Failed to extract or convert valid geometries from TopoJSON layer '${TOPOJSON_OBJECT_KEY}' in ${NEPAL_GEO_URL}. The layer might be empty or malformed.`;
              console.error("HomepageMap:", errorMsg, "Layer:", layer);
              throw new Error(errorMsg);
            }
          } else {
            const errorMsg = `Invalid TopoJSON structure: Layer object for key '${TOPOJSON_OBJECT_KEY}' is not a GeometryCollection or has no geometries. Layer content: ${JSON.stringify(layer).substring(0,200)}...`;
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
            specificError = "Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: " + specificError;
        }
        console.error("HomepageMap: Error in fetchData -", specificError, err);
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchData();
  }, [toast]);

  useEffect(() => {
    const fetchAIDescription = async (featureName: string, featureType: 'District' | 'City') => {
      if (featureType !== 'District' || !featureName) {
        setAiDescription(null);
        setIsFetchingDescription(false);
        return;
      }
      setIsFetchingDescription(true);
      setAiDescription(null);
      try {
        console.log(`HomepageMap: Fetching AI description for district: ${featureName}`);
        const result = await getDistrictDescription({ districtName: featureName });
        if (result && result.description) {
          setAiDescription(result.description);
        } else {
          setAiDescription(`Explore ${featureName}, a unique district in Nepal.`);
        }
      } catch (error) {
        console.error(`HomepageMap: Error generating AI description for ${featureName}:`, error);
        toast({
          title: "AI Description Error",
          description: `Could not fetch AI insights for ${featureName}.`,
          variant: "default",
        });
        setAiDescription(null);
      } finally {
        setIsFetchingDescription(false);
      }
    };

    if (selectedFeatureInfo?.feature.type === 'District' && selectedFeatureInfo.feature.name) {
      fetchAIDescription(selectedFeatureInfo.feature.name, 'District');
    } else {
      setAiDescription(null);
      setIsFetchingDescription(false);
    }
  }, [selectedFeatureInfo, toast]);

  const handleFeatureClick = useCallback((
    featureProps: any, // properties from TopoJSON feature or CityMapData
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGGElement>
  ) => {
    event.stopPropagation();
    const { clientX, clientY } = event;

    const displayName = featureProps?.name || (featureType === 'District' ? (featureProps?.DIST_EN || featureProps?.ADM1_EN || "Unknown District") : "Unknown City");
    const featureId = String(featureProps?.id || featureProps?.rsmKey || displayName + Math.random()); // Use rsmKey if available for geographies
    
    console.log(`${featureType} Clicked:`, displayName, "Event clientX:", clientX, "clientY:", clientY, "Feature ID:", featureId);
    
    const featureData: ExtendedProperties = {
      id: featureId,
      name: displayName,
      type: featureType,
      population: featureProps?.population,
      description: featureProps?.description || `Discover ${displayName}, a fascinating place in Nepal.`,
      link: featureProps?.link || `/districts?name=${encodeURIComponent(displayName)}`,
      properties: featureType === 'District' ? featureProps : undefined,
    };

    setSelectedFeatureInfo({
      feature: featureData,
      clientX: clientX,
      clientY: clientY,
    });
  }, []);
  
  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    setAiDescription(null);
    setIsFetchingDescription(false);
  }, []);

  useEffect(() => {
    if (selectedFeatureInfo && mapContainerRef.current) {
      const { clientX, clientY } = selectedFeatureInfo;
      const mapRect = mapContainerRef.current.getBoundingClientRect();
      const infoBoxWidth = 256; // Corresponds to w-64
      const infoBoxHeight = 200; // Approximate height

      let newLeft = clientX + 15;
      let newTop = clientY + 15;
      let transform = '';

      // Adjust if too close to right edge of map container (relative to viewport)
      if (clientX + infoBoxWidth + 15 > window.innerWidth) { // Check against window width
        newLeft = clientX - 15;
        transform = 'translateX(-100%)';
      }

      // Adjust if too close to bottom edge of map container (relative to viewport)
      if (clientY + infoBoxHeight + 15 > window.innerHeight) { // Check against window height
        newTop = clientY - 15;
        transform += ' translateY(-100%)';
      }
      
      // Ensure it doesn't go off the top or left of the map container (minor adjustments)
      if (newTop < 5) newTop = 5;
      if (newLeft < 5 && !transform.includes('translateX(-100%)')) newLeft = 5;
      if (newLeft - infoBoxWidth < 5 && transform.includes('translateX(-100%)')) newLeft = 5 + infoBoxWidth;


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

  // Debug log for selected feature info state
  useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);

  let displayErrorMessage = fetchError;
  if (isLoadingMapGeometry && !fetchError) { // Show loading only if no error yet
     // Loading state is handled by Skeleton
  } else if (fetchError && !mapData) { // If error and mapData never loaded
    // Error will be shown by the block below
  } else if (!isLoadingMapGeometry && !mapData && !fetchError) { // If not loading, no mapdata, and no specific error, then it's a general fail
     displayErrorMessage = `Map data could not be loaded or is empty. Please ensure '${NEPAL_GEO_URL}' exists in '/public/data/' and is a valid TopoJSON file.`;
  }


  if (displayErrorMessage || (!isLoadingMapGeometry && !mapData)) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">{displayErrorMessage || "An unexpected error occurred while loading map data. Please check console for details."}</p>
        {fetchError && (fetchError.includes("offline") || fetchError.includes("Firebase")) && (
          <p className="text-xs mt-2">This might be due to Firebase configuration issues (check `.env.local` or hosting environment variables) or network problems.</p>
        )}
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
        aria-label="Interactive map of Nepal showing districts and key cities"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
          {/* Geographies for Provinces/Districts */}
          <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedProperties;
                const districtName = properties?.name || "Unknown District";
                const geoIdForSelection = String(geo.rsmKey || properties.id || districtName);
                
                const isSelected =
                  selectedFeatureInfo?.feature.type === 'District' &&
                  selectedFeatureInfo?.feature.id === geoIdForSelection;

                return (
                  <Geography
                    key={geo.rsmKey || districtName + Math.random()} 
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => {
                      // Pass geo.properties and geo.rsmKey as identifier
                      handleFeatureClick({ ...properties, id: geoIdForSelection }, 'District', event);
                    }}
                    style={{
                      default: {
                        fill: isSelected ? 'hsl(var(--accent))' : 'hsl(var(--card))',
                        stroke: isSelected ? 'hsl(var(--accent-foreground))' : 'hsl(var(--border))',
                        strokeWidth: isSelected ? 1.5 : 0.5,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      hover: {
                        fill: isSelected ? 'hsl(var(--accent))' : 'hsl(var(--accent)/0.4)',
                        stroke: 'hsl(var(--accent-foreground))',
                        strokeWidth: 1,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: {
                        fill: isSelected ? 'hsl(var(--accent))' : 'hsl(var(--accent)/0.6)',
                        stroke: 'hsl(var(--accent-foreground))',
                        strokeWidth: 1,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                    }}
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
                const properties = geo.properties as ExtendedProperties;
                const districtName = properties?.name || "Unknown District";
                const centroid = (geo as any).centroid as [number, number] | undefined;

                if (!centroid || !districtName) return null;
                
                let fontSize = 4;
                if (["Kathmandu", "Kaski", "Morang", "Rupandehi", "Pokhara", "Lumbini"].includes(districtName)) fontSize = 5;
                if (["Kathmandu", "Pokhara", "Lumbini"].includes(districtName)) fontSize = 7;

                return (
                  <Marker key={`label-${geo.rsmKey || districtName + Math.random()}`} coordinates={centroid}>
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
            if (city.name === "Kathmandu") labelFontSize = 9; // Specific larger size for Kathmandu
            if (city.name === "Pokhara" || city.name === "Lumbini") labelFontSize = 7;
            
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

      {/* Info Box Card (Styled) */}
      {selectedFeatureInfo && selectedFeatureInfo.feature && (
        <Card
          style={infoBoxStyle}
          className={cn(
            "fixed p-0 shadow-2xl border border-border bg-card text-card-foreground rounded-lg transition-all duration-200 ease-out text-xs",
            "w-56 sm:w-60 md:w-64 max-h-[250px] flex flex-col overflow-hidden" // Responsive width & max height
          )}
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
          <CardContent className="p-2.5 text-xs md:text-sm space-y-1.5 overflow-y-auto flex-grow">
             {selectedFeatureInfo.feature.type === 'District' && isFetchingDescription && (
                <div className="flex items-center text-muted-foreground text-[10px] md:text-xs">
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Loading description...
                </div>
            )}
            {selectedFeatureInfo.feature.type === 'District' && !isFetchingDescription && aiDescription && (
                 <p className="text-muted-foreground line-clamp-4">{aiDescription}</p>
            )}
            {(!aiDescription || selectedFeatureInfo.feature.type === 'City') && selectedFeatureInfo.feature.description && (
                 <p className="text-muted-foreground line-clamp-4">{selectedFeatureInfo.feature.description}</p>
            )}
            {selectedFeatureInfo.feature.population && (
                <p className="text-muted-foreground/80 mt-1.5 text-[10px] md:text-xs">Population: {Number(selectedFeatureInfo.feature.population).toLocaleString()}</p>
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
              >
                Learn More <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
      {isFetchingDescription && !isLoadingMapGeometry && (
          <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading details...
          </div>
      )}
    </div>
  );
}

    