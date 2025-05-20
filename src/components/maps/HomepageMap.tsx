
// src/components/maps/HomepageMap.tsx
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology, type Objects } from 'topojson-client';
import { getDistrictDescription } from '@/ai/flows/get-district-description-flow';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase'; // Assuming firebase is setup
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';


const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // The key in TopoJSON objects that holds the geometry collection

// Define a more specific type for the properties expected in the TopoJSON geometries
interface TopoJsonDistrictProperties {
  id?: string | number; // Optional ID from TopoJSON
  name?: string; // Common property name for the district/province name
  DIST_EN?: string; // Alternative property name
  PROV_EN?: string; // Yet another alternative
  [key: string]: any; // Allow other properties
}

// Combine with our application-specific data needs
interface ExtendedDistrictMapData extends ProvinceMapData {
  // ProvinceMapData already has id, name, population, description, link
  // Add or override if needed
}

interface ExtendedCityMapData extends CityMapData {
  // CityMapData has id, name, coordinates, type, population, description, link, highlight
}

type SelectedFeatureDataType = ExtendedDistrictMapData | ExtendedCityMapData;

interface SelectedFeatureState {
  feature: SelectedFeatureDataType;
  pageX: number;
  pageY: number;
}


export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
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

  const fetchData = useCallback(async () => {
    setIsLoadingMapGeometry(true);
    setFetchError(null);
    setMapData(null);

    if (!db) {
      const errorMsg = "Map Error: Firebase is not initialized. Check Firebase configuration and console for errors.";
      console.error("HomepageMap:", errorMsg);
      setFetchError(errorMsg);
      setIsLoadingMapGeometry(false);
      return;
    }

    try {
      const geoRes = await fetch(NEPAL_GEO_URL);
      if (!geoRes.ok) {
        const errorText = await geoRes.text();
        throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`);
      }
      
      const rawMapData = await geoRes.json() as Topology;

      if (rawMapData && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
        const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
        // @ts-ignore // TopoJSON types can be tricky; layer can be various Geometry types.
        if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
            // @ts-ignore
            const geoJsonFeatures = topojsonFeature(rawMapData, layer!).features as ExtendedFeature[];
            
            if (geoJsonFeatures && geoJsonFeatures.length > 0) {
              setMapData(geoJsonFeatures.map(f => ({
                ...f,
                properties: {
                  ...f.properties,
                  id: String(f.id || (f.properties as TopoJsonDistrictProperties)?.id || (f.properties as TopoJsonDistrictProperties)?.DIST_EN || (f.properties as TopoJsonDistrictProperties)?.name || Math.random().toString(36).substring(7)),
                  name: (f.properties as TopoJsonDistrictProperties)?.name || (f.properties as TopoJsonDistrictProperties)?.DIST_EN || (f.properties as TopoJsonDistrictProperties)?.PROV_EN || "Unknown District/Province",
                  type: 'District',
                  description: (f.properties as TopoJsonDistrictProperties)?.description || `Explore this district of Nepal.`,
                  link: (f.properties as TopoJsonDistrictProperties)?.link || `/districts?name=${encodeURIComponent((f.properties as TopoJsonDistrictProperties)?.name || (f.properties as TopoJsonDistrictProperties)?.DIST_EN || '')}`
                }
              })));
            } else {
              const errorMsg = `Failed to extract or convert valid geometries from TopoJSON layer '${TOPOJSON_OBJECT_KEY}' in ${NEPAL_GEO_URL}. The layer might be empty or malformed.`;
              console.error("HomepageMap:", errorMsg, "Layer:", layer);
              setFetchError(errorMsg);
              setMapData(null);
            }
        } else {
          const errorMsg = `Map data structure error: Expected 'objects.${TOPOJSON_OBJECT_KEY}' to be a GeometryCollection with a 'geometries' array. Received: ${layer?.type || 'unknown layer type'}`;
          console.error("HomepageMap:", errorMsg, "Layer:", layer);
          setFetchError(errorMsg);
          setMapData(null);
        }
      } else {
        const errorMsg = `Invalid TopoJSON data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
        console.error("HomepageMap:", errorMsg);
        setFetchError(errorMsg);
        setMapData(null);
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
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generateDescription = useCallback(async (featureName: string) => {
    try {
      setIsFetchingDescription(true);
      setAiDescription(null); // Clear previous AI description
      const result = await getDistrictDescription({ districtName: featureName });
      if (result && result.description) {
        setAiDescription(result.description);
      } else {
        setAiDescription(`Explore ${featureName}, a captivating district in Nepal.`); // Fallback
      }
    } catch (error) {
      console.error(`Error generating AI description for ${featureName}:`, error);
      toast({
        title: "AI Description Error",
        description: `Could not fetch AI insights for ${featureName}.`,
        variant: "default",
      });
      setAiDescription(`Learn more about the unique attractions of ${featureName}.`); // Fallback
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);


  const handleFeatureClick = useCallback((
    featureProps: any, // Can be properties from TopoJSON or CityMapData
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGElement | SVGGElement> | { pageX: number; pageY: number } // Marker click might not have full SVG event
  ) => {
    event.stopPropagation?.(); // Optional chaining for synthetic events
    
    const localDisplayName = featureProps?.name || "Unknown Area";
    // For districts from TopoJSON, try to use a persistent ID if available, otherwise fallback
    const featureId = String(featureProps?.id || featureProps?.ID || featureProps?.rsmKey || (featureType === 'District' ? (featureProps as TopoJsonDistrictProperties)?.DIST_EN : null) || localDisplayName + Math.random());

    const clientX = 'clientX' in event ? (event as React.MouseEvent).clientX : event.pageX;
    const clientY = 'clientY' in event ? (event as React.MouseEvent).clientY : event.pageY;

    console.log(`${featureType} Clicked:`, localDisplayName, "Event clientX:", clientX, "clientY:", clientY, "Feature ID:", featureId);
    
    let featureData: SelectedFeatureDataType;

    if (featureType === 'District') {
      const currentProperties = featureProps as TopoJsonDistrictProperties;
      featureData = {
        id: featureId,
        name: localDisplayName,
        type: 'District',
        population: currentProperties?.POP_MAX, // Example, adjust to your TopoJSON
        description: currentProperties?.description || `Discover ${localDisplayName}, a unique district in Nepal.`,
        link: currentProperties?.link || `/districts?name=${encodeURIComponent(localDisplayName)}`,
        properties: currentProperties,
      };
      if (localDisplayName !== "Unknown Area") {
        generateDescription(localDisplayName);
      }
    } else { // City
      const cityProps = featureProps as ExtendedCityMapData;
      featureData = {
        ...cityProps, // Spread existing city data
        id: featureId,
        name: localDisplayName,
        type: 'City',
      };
      setAiDescription(null); // No AI description for cities by default
      setIsFetchingDescription(false);
    }
    
    setSelectedFeatureInfo({
      feature: featureData,
      pageX: clientX,
      pageY: clientY,
    });

  }, [generateDescription]);


  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    setAiDescription(null);
    setIsFetchingDescription(false);
  }, []);
  
  useEffect(() => {
     console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  let displayErrorMessage = fetchError;
  if (!fetchError && !isLoadingMapGeometry && !mapData) {
    displayErrorMessage = `Map data (${NEPAL_GEO_URL}) could not be loaded or is empty. Please ensure the file exists in /public/data/ and is a valid TopoJSON.`;
  } else if (!fetchError && !isLoadingMapGeometry && mapData && mapData.length === 0) {
     displayErrorMessage = `Map data from ${NEPAL_GEO_URL} was processed but resulted in an empty feature set. Ensure the TopoJSON layer '${TOPOJSON_OBJECT_KEY}' contains geometries.`;
  }
  
  if (displayErrorMessage || (!isLoadingMapGeometry && !mapData)) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Display Error</p>
        <p className="text-sm">{displayErrorMessage || "An unknown error occurred while loading map data."}</p>
        <p className="text-xs mt-2">Please check console for details and ensure your Firebase configuration and map data files are correct.</p>
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
            geography={mapData} // mapData should be an array of GeoJSON features
          >
            {({ geographies }) =>
              geographies.map(geo => {
                const districtProperties = geo.properties as ExtendedDistrictMapData;
                const districtName = districtProperties?.name || "Unknown District";
                // Ensure a unique key, geo.rsmKey is preferred if available
                const geoId = geo.rsmKey || districtProperties.id || districtName + Math.random();
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
                        ? 'fill-accent stroke-accent-foreground stroke-[1.75px] opacity-100' // More prominent selected style
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
                const properties = geo.properties as ExtendedDistrictMapData;
                const districtName = properties?.name || "Unknown District";
                const centroid = (geo as any).centroid as [number, number] | undefined; // Access centroid if available

                if (!centroid || !districtName) return null;
                
                let fontSize = 4; // Base font size for labels
                if (["Kathmandu", "Kaski", "Morang", "Rupandehi"].includes(districtName)) fontSize = 5;
                if (districtName === "Kathmandu") fontSize = 6;

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
            if (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") {
                labelFontSize = city.name === "Kathmandu" ? 6 : 5;
            }
             if (city.name === "Biratnagar" || city.name === "Nepalgunj" || city.name === "Janakpur") {
                labelFontSize = 4.5;
            }

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
                    r={isSelected ? 4 : 2.5} // Adjusted size
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
                "fixed p-0 w-56 sm:w-60 md:w-64 shadow-xl border border-border bg-card text-card-foreground rounded-lg z-[1000] transition-all duration-200 ease-out",
                "transform-gpu" 
            )}
            style={{
                left: `${Math.min(selectedFeatureInfo.pageX + 15, window.innerWidth - (mapContainerRef.current?.offsetWidth > 768 ? 256 : (mapContainerRef.current?.offsetWidth > 640 ? 240 : 224)) - 15 )}px`,
                top: `${Math.min(selectedFeatureInfo.pageY + 15, window.innerHeight - 150 - 15 )}px`, // Adjusted for smaller height
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
                     <div className="flex items-center text-muted-foreground my-1 text-xs">
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
                {!isFetchingDescription && !aiDescription && !selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground italic line-clamp-3">Explore {selectedFeatureInfo.feature.name}, a notable area in Nepal.</p>
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
    {/* Loading indicator for AI description (if a district is selected but description is still fetching) */}
    {isFetchingDescription && !isLoadingMapGeometry && (
        <div className="absolute bottom-2 right-2 p-1.5 bg-muted/80 text-muted-foreground text-[10px] rounded-md flex items-center gap-1.5 z-50">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
