
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

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // This should match the layer name in your TopoJSON file

interface ExtendedProvinceMapData extends ProvinceMapData {
  rsmKey: string; // Or whatever unique key react-simple-maps assigns
}
interface ExtendedCityMapData extends CityMapData {
   rsmKey?: string; // Optional, as markers might not get this
}


interface SelectedFeatureDisplayInfo {
  feature: ExtendedProvinceMapData | ExtendedCityMapData;
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [mapData, setMapData] = useState<Topology | null>(null);
  const [provinceDetails, setProvinceDetails] = useState<Record<string, ProvinceMapDatalike_Firestore>>({});
  const [cityDetails, setCityDetails] = useState<Record<string, CityMapData>>({});
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  interface ProvinceDatalike_Firestore extends Omit<ProvinceMapData, 'id' | 'type'> {
    // Firestore might store population as number or string
    population?: number | string;
  }


  const majorCities: CityMapData[] = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', link: '/districts?name=Kathmandu', population: 1442271, description: "The vibrant capital city, rich in ancient culture and bustling markets." },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', link: '/districts?name=Kaski', population: 400000, description: "A picturesque city nestled by Phewa Lake, offering stunning Himalayan views." },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', link: '/districts?name=Rupandehi', population: 70000, description: "The sacred birthplace of Lord Buddha, a major pilgrimage site." },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      console.log("HomepageMap: Starting data fetch...");

      if (!db) {
        const errorMsg = "Firebase Firestore (db instance) is not initialized. This usually means Firebase configuration (API keys, Project ID in .env.local or hosting environment variables) is missing or incorrect. Please verify your setup in src/lib/firebase.ts.";
        console.error("HomepageMap: FATAL - Firestore not initialized.", errorMsg);
        setFetchError(errorMsg);
        setIsLoading(false);
        return;
      }

      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const rawMapData = await geoRes.json();
        console.log("HomepageMap: Raw map data fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");

        if (!rawMapData || typeof rawMapData.objects !== 'object' || !rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null); // Explicitly set to null on error
          setIsLoading(false);
          return;
        }
        setMapData(rawMapData as Topology);
        console.log("HomepageMap: TopoJSON map data seems valid and set.");

        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const pDetails: Record<string, ProvinceDatalike_Firestore> = {};
        provincesSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as ProvinceDatalike_Firestore;
          const key = (data.id || data.name || docSnap.id).toLowerCase().replace(/\s+/g, '_');
          pDetails[key] = { ...data, id: docSnap.id };
        });
        setProvinceDetails(pDetails);
        console.log("HomepageMap: Province details fetched:", Object.keys(pDetails).length, pDetails);

        const cDetails: Record<string, CityMapData> = {};
         for (const city of majorCities) {
          const cityDocRef = doc(db, "nepal_major_cities_data", city.id);
          const cityDocSnap = await getDoc(cityDocRef);
          if (cityDocSnap.exists()) {
             cDetails[city.id] = { ...city, ...(cityDocSnap.data() as Partial<Omit<CityMapData, 'id' | 'coordinates' | 'type'>>), type: 'City' } as CityMapData;
          } else {
            console.warn(`HomepageMap: No Firestore data found for city ${city.id}. Using default data.`);
            cDetails[city.id] = {...city, type: 'City'}; // Use default city data if not in Firestore
          }
        }
        setCityDetails(cDetails);
        console.log("HomepageMap: City details fetched/merged:", Object.keys(cDetails).length, cDetails);

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
  }, []);

  const handleFeatureClick = useCallback((
    featureData: ExtendedProvinceMapData | ExtendedCityMapData,
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

  // Error or Loading State Display
  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map...</p>
      </div>
    );
  }

  let displayErrorMessage = fetchError;
  if (fetchError) {
    if (fetchError.toLowerCase().includes("offline") || fetchError.toLowerCase().includes("failed to get document")) {
        displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
    } else if (fetchError.includes("Invalid map data structure") || fetchError.includes(TOPOJSON_OBJECT_KEY) || fetchError.includes("404") ) {
        displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}'). Original: ${fetchError}`;
    }
  }
  
  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is unavailable. Please ensure the TopoJSON file is correct and Firebase is configured."}</p>
      </div>
    );
  }
  
  if (!mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY] || typeof (mapData.objects[TOPOJSON_OBJECT_KEY] as any).geometries === 'undefined') {
      console.error("HomepageMap: Critical error - Invalid TopoJSON structure or missing/invalid layer. Key used:", TOPOJSON_OBJECT_KEY, "Available objects:", mapData.objects);
      return (
          <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
              <Globe className="h-10 w-10 mb-2" />
              <p className="font-semibold text-lg mb-1">Map Layer Configuration Error</p>
              <p className="text-sm">The TopoJSON file at {NEPAL_GEO_URL} is missing the expected layer named &quot;{TOPOJSON_OBJECT_KEY}&quot; or its structure is invalid. It should contain a `GeometryCollection` with a `geometries` array under this key.</p>
          </div>
      );
  }


  return (
    <div
      ref={mapContainerRef}
      className="relative w-full aspect-[16/9] bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={closeInfoBox} 
    >
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
                const geoId = geo.rsmKey || geo.id || String(geo.properties?.id || Math.random()); // Ensure unique key
                const properties = geo.properties as ProvinceMapData;
                const provinceName = properties?.name || properties?.ADM1_EN || "Unknown Province";
                
                const detailsFromState = provinceDetails[provinceName.toLowerCase().replace(/\s+/g, '_')] ||
                                         provinceDetails[(properties?.id as string || geoId).toLowerCase().replace(/\s+/g, '_')] ||
                                         {name: provinceName, type: 'Province', link: `/districts?name=${encodeURIComponent(provinceName)}`, id: geoId, description: `Explore ${provinceName}.`};
                
                const featureDataForInfoBox: ExtendedProvinceMapData = {
                  ...detailsFromState,
                  id: geoId, // Use rsmKey as the unique ID for selection
                  name: provinceName,
                  type: 'Province',
                  link: detailsFromState.link || `/districts?name=${encodeURIComponent(provinceName)}`,
                  description: detailsFromState.description || `Detailed information about ${provinceName}.`,
                  rsmKey: geoId
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
                            : 'fill-gray-100 dark:fill-gray-700 stroke-gray-400 dark:stroke-gray-500 stroke-[0.5px] hover:fill-accent/30 dark:hover:fill-accent/20'
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
                // This function extracts the 'geometries' array from the correct layer in TopoJSON
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

                    let fontSize = 5; // md:text-[6px]
                    if (["Bagmati", "Gandaki", "Lumbini", "Koshi"].some(p => provinceName.includes(p))) {
                        fontSize = provinceName.includes("Bagmati") ? 6 : 5.5; // md:text-[7px] or md:text-[6.5px]
                    }
                    if (provinceName.length > 15) fontSize = 4; // md:text-[5px]

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
            const cityInfoFromState = cityDetails[city.id] || city;
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo?.feature.type === 'City';
            
            let labelFontSize = 6; // md:text-[7px]
            if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) {
                labelFontSize = (city.name === "Kathmandu" || city.name === "Pokhara") ? 7 : 6.5;
            }
            
            const featureDataForInfoBox: ExtendedCityMapData = {
                ...cityInfoFromState,
                type: 'City'
            };

            return (
              <Marker key={city.id} coordinates={city.coordinates} onClick={(event) => handleFeatureClick(featureDataForInfoBox, event as any)}>
                 <g
                  className={`cursor-pointer transition-all duration-150 ease-out group`}
                >
                  <circle 
                    r={isSelected ? 5 : 4} 
                    className={isSelected ? 'fill-accent stroke-accent-foreground' : 'fill-primary stroke-primary-foreground group-hover:fill-accent group-hover:stroke-accent-foreground'}
                    strokeWidth={0.5}
                  />
                </g>
                <text
                  textAnchor="middle"
                  y={-8} 
                  fontSize={labelFontSize}
                  className={`select-none pointer-events-none transition-opacity duration-150
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/80 dark:fill-gray-200 group-hover:opacity-100'}`}
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
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[60] transition-all duration-200 ease-out"
            style={{
                left: `${selectedFeatureInfo.pageX + 15}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288+30 : 256+30) // 288px = 72*4 (w-72), 256px = 64*4 (w-64)
                                ? 'translateX(calc(-100% - 30px))'
                                : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent map click from closing the info box
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
                {selectedFeatureInfo.feature.population && (
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

// Debug Helper: Deep get a property, returning a default if path is invalid
function getProperty(obj: any, path: string, defaultValue: string = "Unknown") {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }
  return typeof current === 'string' ? current : defaultValue;
}

