
"use client";

import type { LegacyRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, doc, getDoc, type DocumentData } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, InfoIcon, XIcon, Globe } from 'lucide-react';
import { feature } from 'topojson-client';
import type { Topology, Objects } from 'topojson-specification';

// This key MUST match the object layer name in your TopoJSON file that contains the province/district geometries.
// Based on your error log, your file uses "nepal".
const TOPOJSON_OBJECT_KEY = "nepal";
const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Ensure this file exists in public/data/

interface SelectedFeatureDisplayInfo {
  feature: ProvinceMapData | CityMapData; // Using specific types
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [mapData, setMapData] = useState<Topology | null>(null); // Stores the raw TopoJSON
  const [provinceDetails, setProvinceDetails] = useState<Record<string, ProvinceMapData>>({});
  const [cityDetails, setCityDetails] = useState<Record<string, CityMapData>>({});
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Predefined major cities - coordinates will be used directly, details fetched from Firestore
  const majorCities: Omit<CityMapData, 'population' | 'description' | 'link'>[] = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', highlight: true },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', highlight: true },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', highlight: true },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      console.log("HomepageMap: Starting data fetch...");

      if (!db) {
        const errorMsg = "Firebase Firestore (db instance) is not available. This usually means Firebase failed to initialize. Check console for errors in src/lib/firebase.ts, and verify ALL NEXT_PUBLIC_FIREBASE_... environment variables are correctly set in your .env.local or hosting provider settings.";
        console.error("HomepageMap:", errorMsg);
        setFetchError(errorMsg);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch TopoJSON for map geometry
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const rawMapData = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");

        if (!rawMapData || typeof rawMapData.objects !== 'object' || !rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
          setIsLoading(false);
          return;
        }
        setMapData(rawMapData as Topology); // Store the raw TopoJSON
        console.log("HomepageMap: TopoJSON map data seems valid and set. Object key for geometries:", TOPOJSON_OBJECT_KEY);
        
        // Fetch province details from Firestore
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const pDetails: Record<string, ProvinceMapData> = {};
        provincesSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as ProvinceMapData; // Assume this matches ProvinceMapData
          const key = (data.id || data.name || docSnap.id).toLowerCase().replace(/\s+/g, '_');
          pDetails[key] = { ...data, id: docSnap.id, type: 'Province' };
        });
        setProvinceDetails(pDetails);
        console.log("HomepageMap: Province details fetched:", Object.keys(pDetails).length, "keys:", Object.keys(pDetails));

        // Fetch city details from Firestore
        const cDetails: Record<string, CityMapData> = {};
        for (const city of majorCities) {
          const cityDocRef = doc(db, "nepal_major_cities_data", city.id);
          const cityDocSnap = await getDoc(cityDocRef);
          if (cityDocSnap.exists()) {
             cDetails[city.id] = { 
                ...city, 
                ...(cityDocSnap.data() as Partial<Omit<CityMapData, 'id' | 'coordinates' | 'type'>>), 
                type: 'City' 
            } as CityMapData;
          } else {
            console.warn(`HomepageMap: No Firestore data found for city ${city.id}. Using default marker data.`);
            cDetails[city.id] = {...city, type: 'City', link: `/cities/${city.id}`, description: `Learn more about ${city.name}.`}; // Default fallback
          }
        }
        setCityDetails(cDetails);
        console.log("HomepageMap: City details fetched/merged:", Object.keys(cDetails).length, "keys:", Object.keys(cDetails));

      } catch (err) {
        console.error("HomepageMap: Error during data fetching process:", err);
        let specificError = "An unknown error occurred while fetching map data.";
        if (err instanceof Error) {
          specificError = err.message;
           if (err.message.includes("offline") || err.message.includes("Failed to get document")) {
            specificError = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${err.message}`;
          } else if (err.message.includes(NEPAL_GEO_URL) && (err.message.includes("404") || err.message.includes("Not Found"))) {
             specificError = `Map geometry file (${NEPAL_GEO_URL}) not found. Ensure it's in the public/data directory and the path is correct.`;
          }
        }
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: Data fetching finished.");
      }
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed db from dependencies as its availability is checked inside

  const handleFeatureClick = useCallback((
    featureData: ProvinceMapData | CityMapData, // Use specific types
    event: React.MouseEvent<SVGElement | SVGGElement>
  ) => {
    event.stopPropagation();
    console.log("HomepageMap: Feature Clicked:", featureData.name, "Event pageX:", event.pageX, "pageY:", event.pageY);
    setSelectedFeatureInfo({
      feature: featureData,
      pageX: event.pageX,
      pageY: event.pageY,
    });
  }, []);

  const closeInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);

  useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);

  // Error or Loading State Display
  let displayErrorMessage = fetchError;
  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map...</p>
      </div>
    );
  }
  
  if (fetchError || !mapData) {
    if (fetchError && (fetchError.toLowerCase().includes("offline") || fetchError.toLowerCase().includes("failed to get document"))) {
        displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
    } else if (fetchError && fetchError.includes(NEPAL_GEO_URL)) { // Check if error is about fetching GEO URL
        displayErrorMessage = `Map Error: Failed to load map geometry from ${NEPAL_GEO_URL}. Ensure the file exists in public/data and is accessible. Original: ${fetchError}`;
    } else if (!mapData && !fetchError) { // No mapData, but no fetchError means it's likely still loading or init failed silently
        displayErrorMessage = "Map data is currently unavailable. Please try again shortly.";
    }
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Initialization Error</p>
        <p className="text-sm">{displayErrorMessage}</p>
      </div>
    );
  }
  
  if (!mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY] || typeof mapData.objects[TOPOJSON_OBJECT_KEY].geometries === 'undefined') {
      console.error("HomepageMap: Critical error - Invalid TopoJSON structure or missing/invalid layer. Key used:", TOPOJSON_OBJECT_KEY, "Available objects in TopoJSON:", mapData.objects ? Object.keys(mapData.objects) : "mapData.objects is undefined", "Layer content:", mapData.objects ? mapData.objects[TOPOJSON_OBJECT_KEY] : "N/A");
      displayErrorMessage = `Map Error: The TopoJSON file (${NEPAL_GEO_URL}) has an invalid structure or the expected layer ('${TOPOJSON_OBJECT_KEY}') is missing/malformed. Please verify your TopoJSON file.`;
       return (
          <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
              <Globe className="h-10 w-10 mb-2" />
              <p className="font-semibold text-lg mb-1">Map Layer Error</p>
              <p className="text-sm">{displayErrorMessage}</p>
          </div>
      );
  }


  return (
    <div
      ref={mapContainerRef}
      className="relative w-full aspect-[16/9] bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={closeInfoBox} 
    >
       {/* Top-level debug text to check state updates */}
       {/* {selectedFeatureInfo && (
        <div className="fixed top-0 left-0 bg-yellow-300 text-black p-2 z-[100000]">
          DEBUG: Clicked {selectedFeatureInfo.feature.name} at X:{selectedFeatureInfo.pageX}, Y:{selectedFeatureInfo.pageY}
        </div>
      )} */}
       <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 2800, 
          center: [84.1240, 28.3949] 
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing provinces and major cities"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
          <Geographies 
            geography={mapData} 
            parseGeographies={data => {
                // This function extracts the 'geometries' array from the correct layer in TopoJSON
                if (!data || typeof data.objects !== 'object' || data.objects === null) {
                  console.error("parseGeographies (provinces): Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                  return [];
                }
                const key = TOPOJSON_OBJECT_KEY; 
                if (!key || !data.objects[key]) {
                  console.error(`parseGeographies (provinces): Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                  return [];
                }
                const layer = data.objects[key] as any; 
                if (layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                  return layer.geometries;
                }
                console.error(`parseGeographies (provinces): Layer for key "${key}" is not a GeometryCollection or does not have a 'geometries' array. Layer type:`, layer.type);
                return [];
            }}
          >
            {({ geographies }) =>
              geographies.map((geo: ExtendedFeature) => {
                const geoId = geo.rsmKey || geo.id || String(geo.properties?.id || Math.random()); 
                const provinceName = geo.properties?.name || geo.properties?.ADM1_EN || "Unknown Province";
                const detailsKey = provinceName.toLowerCase().replace(/\s+/g, '_');
                const details = provinceDetails[detailsKey] || {name: provinceName, type: 'Province', id: geoId, description: `Explore ${provinceName}.`, link: `/districts?name=${encodeURIComponent(provinceName)}`};
                
                const featureDataForInfoBox: ProvinceMapData = {
                  ...details,
                  id: geoId, 
                  name: provinceName,
                  type: 'Province',
                };

                const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === 'Province';

                return (
                  <Geography
                    key={geoId}
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(featureDataForInfoBox, event)}
                    className={
                      `transition-all duration-150 ease-out cursor-pointer
                       ${isSelected 
                            ? 'fill-accent/70 dark:fill-accent/60 stroke-accent-foreground dark:stroke-accent-foreground/80 stroke-[1.5px]'
                            : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-500 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30'
                       }`
                    }
                    aria-label={provinceName}
                  />
                );
              })
            }
          </Geographies>

          <Geographies
            geography={mapData}
            parseGeographies={data => {
                if (!data || typeof data.objects !== 'object' || data.objects === null) {
                  console.error("parseGeographies (labels): Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                  return [];
                }
                const key = TOPOJSON_OBJECT_KEY; 
                if (!key || !data.objects[key]) {
                  console.error(`parseGeographies (labels): Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                  return [];
                }
                const layer = data.objects[key] as any; 
                if (layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                  return layer.geometries;
                }
                console.error(`parseGeographies (labels): Layer for key "${key}" is not a GeometryCollection or does not have a 'geometries' array. Layer type:`, layer.type);
                return [];
            }}
          >
            {({ geographies }) =>
                geographies.map((geo: ExtendedFeature) => {
                    const properties = geo.properties as ProvinceMapData;
                    const provinceName = properties?.name || properties?.ADM1_EN || "";
                    const centroid = (geo as any).centroid as [number, number] | undefined; 
                    
                    if (!centroid || !provinceName) return null;

                    let fontSize = 5;
                    if (["Kathmandu", "Pokhara", "Lumbini"].some(p => provinceName.includes(p))) {
                        fontSize = provinceName.includes("Kathmandu") ? 7 : 6;
                    } else if (["Bagmati", "Gandaki", "Koshi"].some(p => provinceName.includes(p))) {
                        fontSize = provinceName.includes("Bagmati") ? 6 : 5.5;
                    }
                    if (provinceName.length > 15) fontSize = 4;

                    return (
                        <Marker key={`label-${geo.rsmKey || provinceName}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={0}
                                fontSize={fontSize}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground/80 dark:fill-gray-200 font-medium pointer-events-none select-none"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                            >
                                {provinceName.replace(" Province", "")}
                            </text>
                        </Marker>
                    );
                })
            }
          </Geographies>

          {majorCities.map((city) => {
            const cityInfo = cityDetails[city.id] || city; // Fallback to predefined city data
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo?.feature.type === 'City';
            
            const featureDataForInfoBox: CityMapData = {
                ...cityInfo,
                type: 'City'
            };

            let labelFontSize = 6;
            let pinSize = 16; // Corresponds to h-4 w-4 approx.
            if (["Kathmandu", "Pokhara"].includes(city.name)) {
                labelFontSize = 7;
                pinSize = 20;
            } else if (city.name === "Lumbini") {
                labelFontSize = 6.5;
                pinSize = 18;
            }

            return (
              <Marker key={city.id} coordinates={city.coordinates} onClick={(event: any) => handleFeatureClick(featureDataForInfoBox, event )}>
                 <g
                  className={`cursor-pointer transition-all duration-150 ease-out group`}
                  // No direct transform for simple circle, handled by marker position
                >
                  <circle
                    r={isSelected ? 6 : 5} 
                    className={isSelected 
                        ? 'fill-accent stroke-accent-foreground dark:fill-accent dark:stroke-accent-foreground' 
                        : 'fill-primary stroke-primary-foreground group-hover:fill-accent group-hover:stroke-accent-foreground'}
                    strokeWidth={0.5}
                  />
                </g>
                <text
                  textAnchor="middle"
                  y={-10} // Adjusted for circle marker
                  fontSize={labelFontSize}
                  className={`select-none pointer-events-none transition-opacity duration-150
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/90 dark:fill-gray-200 group-hover:opacity-100 group-hover:fill-accent'}`}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                >
                  {city.name}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

    {selectedFeatureInfo && (
        <Card
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[9999] transition-all duration-200 ease-out"
            style={{
                left: `${selectedFeatureInfo.pageX + 15}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288+30 : 256+30) 
                                ? 'translateX(calc(-100% - 30px))'
                                : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} 
        >
            <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-base font-bold leading-tight flex items-center text-primary">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                    {selectedFeatureInfo.feature.type && <p className="text-xs text-muted-foreground pt-0.5 pl-[1.375rem]">{selectedFeatureInfo.feature.type}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" onClick={closeInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
            {(selectedFeatureInfo.feature.description || selectedFeatureInfo.feature.population) && (
                <CardContent className="p-3 text-xs space-y-1">
                {typeof selectedFeatureInfo.feature.population === 'number' && (
                    <p className="text-muted-foreground">
                    <span className="font-medium text-foreground/90">Population:</span> {Number(selectedFeatureInfo.feature.population).toLocaleString()}
                    </p>
                )}
                {selectedFeatureInfo.feature.description && (
                    <p className="text-muted-foreground line-clamp-3">
                    {selectedFeatureInfo.feature.description}
                    </p>
                )}
                </CardContent>
            )}
            {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 border-t pt-2">
                <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground"
                onClick={() => {
                    if(selectedFeatureInfo.feature.link) router.push(selectedFeatureInfo.feature.link);
                    closeInfoBox();
                }}
                >
                Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
                </Button>
            </CardFooter>
            )}
        </Card>
    )}
    </div>
  );
}

