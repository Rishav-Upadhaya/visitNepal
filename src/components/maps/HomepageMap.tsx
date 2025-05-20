
"use client";

import type { LegacyRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { ProvinceMapData, CityMapData } from '@/types'; // Adjusted to use refined types
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react'; // Added Loader2
import { feature as topojsonFeature, type Topology, type Objects } from 'topojson-client';

// This key MUST match the object layer name in your TopoJSON file that contains the province/district geometries.
const TOPOJSON_OBJECT_KEY = "nepal";
const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";

interface SelectedFeatureDisplayInfo {
  feature: ProvinceMapData | CityMapData; // Using combined type
  pageX: number;
  pageY: number;
}

// Define a more specific type for the features expected from TopoJSON conversion
interface ExtendedFeatureProperties {
  name?: string; // Default name property
  ADM1_EN?: string; // GADM English name for Province (Admin Level 1)
  DIST_EN?: string; // GADM English name for District
  [key: string]: any; // Allow other properties
}

interface ExtendedFeature extends GeoJSON.Feature<GeoJSON.Geometry, ExtendedFeatureProperties> {
  rsmKey: string; // react-simple-maps adds this key
  // Add other properties if react-simple-maps populates them, e.g., centroid
  centroid?: [number, number];
}


export function HomepageMap() {
  const [mapData, setMapData] = useState<Topology | null>(null);
  const [provinceDetails, setProvinceDetails] = useState<Record<string, ProvinceMapData>>({});
  const [cityDetails, setCityDetails] = useState<Record<string, CityMapData>>({});
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);

  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const majorCities: Omit<CityMapData, 'population' | 'description' | 'link' | 'type'>[] = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], highlight: true },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], highlight: true },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], highlight: true },
  ];

  useEffect(() => {
    const fetchData = async () => {
      console.log("HomepageMap: Starting data fetch sequence...");
      if (!db) {
        const errorMsg = "Firebase Firestore (db instance) is not available. This usually means Firebase failed to initialize. Check console for errors in src/lib/firebase.ts, and verify ALL NEXT_PUBLIC_FIREBASE_... environment variables are correctly set.";
        console.error("HomepageMap: fetchData -", errorMsg);
        setFetchError(errorMsg);
        setIsLoadingMapGeometry(false);
        setIsLoadingDetails(false);
        return;
      }

      // Fetch TopoJSON map geometry
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      try {
        console.log(`HomepageMap: Fetching map geometry from ${NEPAL_GEO_URL}...`);
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
        const rawMapData: any = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON data fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 300) + "...");

        if (rawMapData.type !== 'Topology' || typeof rawMapData.objects !== 'object' || !rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const errorMsg = `Invalid TopoJSON data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
        } else {
          setMapData(rawMapData);
          console.log(`HomepageMap: TopoJSON map geometry data seems valid and set. Object key for geometries: ${TOPOJSON_OBJECT_KEY}`);
        }
      } catch (err) {
        console.error("HomepageMap: Error fetching or parsing map geometry:", err);
        const specificError = err instanceof Error ? err.message : "An unknown error occurred while fetching map geometry.";
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
        console.log("HomepageMap: Map geometry fetching finished.");
      }

      // Fetch details from Firestore
      setIsLoadingDetails(true);
      try {
        console.log("HomepageMap: Starting Firestore details fetch...");
        // Fetch province details
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const pDetails: Record<string, ProvinceMapData> = {};
        provincesSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Use a consistent key, e.g., lowercase name or a specific ID field from properties if available
          const key = (data.id_key || docSnap.id).toLowerCase().replace(/\s+/g, '_');
          pDetails[key] = { ...data, id: docSnap.id, type: 'Province' } as ProvinceMapData;
        });
        setProvinceDetails(pDetails);
        console.log("HomepageMap: Province details fetched:", Object.keys(pDetails).length);

        // Fetch city details
        const cDetails: Record<string, CityMapData> = {};
        for (const city of majorCities) {
          const cityDocRef = doc(db, "nepal_major_cities_data", city.id);
          const cityDocSnap = await getDoc(cityDocRef);
          if (cityDocSnap.exists()) {
             cDetails[city.id] = {
                ...city, // Spread default city data first
                ...(cityDocSnap.data() as Partial<Omit<CityMapData, 'id' | 'coordinates' | 'type'>>), // Spread Firestore data
                type: 'City' // Ensure type is City
            } as CityMapData;
          } else {
            console.warn(`HomepageMap: No Firestore data found for city ${city.id}. Using default marker data.`);
            cDetails[city.id] = {...city, type: 'City', link: `/districts?name=${city.name}`, description: `Learn more about ${city.name}.`};
          }
        }
        setCityDetails(cDetails);
        console.log("HomepageMap: City details fetched/merged:", Object.keys(cDetails).length);

      } catch (err) {
        console.error("HomepageMap: Error fetching details from Firestore:", err);
        let specificError = "An unknown error occurred while fetching map details from Firestore.";
         if (err instanceof Error) {
          specificError = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${err.message}`;
        }
        // Append to existing fetchError rather than overwriting, if map geometry also failed
        setFetchError(prev => prev ? `${prev}\n${specificError}` : specificError);
      } finally {
        setIsLoadingDetails(false);
        console.log("HomepageMap: Firestore details fetching finished.");
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed db from dependencies to avoid re-fetch on db instance change, which shouldn't happen.

  const handleFeatureClick = useCallback((
    featureData: ProvinceMapData | CityMapData,
    event: React.MouseEvent<SVGElement | SVGGElement>
  ) => {
    event.stopPropagation(); // Prevent map background click from closing immediately
    // console.log("HomepageMap: Feature Clicked:", featureData.name, "Event pageX:", event.pageX, "pageY:", event.pageY);
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


  let displayErrorMessage = fetchError;
  if (fetchError && (fetchError.includes("offline") || fetchError.includes("Failed to get document"))) {
    displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
  }


  if (isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map Geometry...</p>
      </div>
    );
  }

  // Handle critical errors that prevent map rendering
  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable."}</p>
        {displayErrorMessage && displayErrorMessage.includes("Firebase") && (
          <p className="text-xs mt-2 italic">Check your browser console and Firebase environment variable setup.</p>
        )}
      </div>
    );
  }

  // Check if the main TopoJSON object and the specific layer exist
  if (!mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY]) {
    const errorMsg = `HomepageMap: Critical error - Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Expected 'objects.${TOPOJSON_OBJECT_KEY}' to exist. Available objects: ${mapData.objects ? Object.keys(mapData.objects).join(', ') : 'N/A'}`;
    console.error(errorMsg);
    return (
        <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
            <Globe className="h-10 w-10 mb-2" />
            <p className="font-semibold text-lg mb-1">Map Data Structure Error</p>
            <p className="text-sm">{errorMsg}</p>
        </div>
    );
  }


  return (
    <div
      ref={mapContainerRef}
      className="relative w-full aspect-[16/9] bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={closeInfoBox}
    >
        {/* Debug text display */}
        {/* <div className="fixed top-2 left-2 bg-yellow-300 text-black p-2 z-[100000] text-xs">
            Debug: {selectedFeatureInfo ? `Selected: ${selectedFeatureInfo.feature.name} at ${selectedFeatureInfo.pageX},${selectedFeatureInfo.pageY}` : "No feature selected"}
        </div> */}

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
                  console.error("parseGeographies: Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                  return [];
                }
                const key = TOPOJSON_OBJECT_KEY; // Use the hardcoded key
                const layer = data.objects[key!];

                if (!layer) {
                  console.error(`parseGeographies: Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                  return [];
                }

                if (layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                  return layer.geometries;
                }
                // If it's a single geometry type, react-simple-maps might handle it if wrapped in an array
                if (["Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(layer.type) && layer.coordinates) {
                   console.warn(`parseGeographies: Layer for key "${key}" is a single geometry, not a GeometryCollection. Wrapping it.`)
                   return [layer as GeoJSON.Geometry]; // Attempt to wrap single geometry
                }
                console.error(`parseGeographies: Layer for key "${key}" is not a GeometryCollection and does not have a 'geometries' array, nor is it a recognized single geometry. Layer type:`, layer.type);
                return [];
            }}
          >
            {({ geographies }) =>
              geographies.map((geo: ExtendedFeature) => {
                const currentProperties = geo.properties || {};
                const provinceName = currentProperties?.name || currentProperties?.ADM1_EN || "Unknown Province";
                const detailsKey = provinceName.toLowerCase().replace(/\s+/g, '_');
                const firestoreDetails = provinceDetails[detailsKey];

                const featureDataForInfoBox: ProvinceMapData = {
                  id: geo.rsmKey || geo.id || String(currentProperties?.id || Math.random()),
                  name: firestoreDetails?.name || provinceName,
                  type: 'Province',
                  population: firestoreDetails?.population,
                  description: firestoreDetails?.description || `Explore the ${provinceName}.`,
                  link: firestoreDetails?.link || `/districts?name=${encodeURIComponent(provinceName)}`,
                  properties: currentProperties
                };

                const isSelected = selectedFeatureInfo?.feature.id === featureDataForInfoBox.id && selectedFeatureInfo.feature.type === 'Province';

                return (
                  <Geography
                    key={featureDataForInfoBox.id}
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => {
                        console.log("Geography Clicked:", provinceName, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureDataForInfoBox);
                        handleFeatureClick(featureDataForInfoBox, event);
                    }}
                    className={
                      `transition-all duration-150 ease-out outline-none
                       ${isSelected
                            ? 'fill-accent/70 dark:fill-accent/60 stroke-accent-foreground dark:stroke-accent-foreground/80 stroke-[1.5px]'
                            : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer'
                       }`
                    }
                    aria-label={provinceName}
                  />
                );
              })
            }
          </Geographies>

          <Geographies
            geography={mapData} // Pass the full TopoJSON
            parseGeographies={data => {
                // This function extracts the 'geometries' array from the correct layer in TopoJSON
                if (!data || typeof data.objects !== 'object' || data.objects === null) {
                  console.error("parseGeographies (labels): Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                  return [];
                }
                const key = TOPOJSON_OBJECT_KEY; // Use the hardcoded key
                const layer = data.objects[key!];

                if (!layer) {
                  console.error(`parseGeographies (labels): Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                  return [];
                }

                if (layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                  return layer.geometries;
                }
                if (["Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(layer.type) && layer.coordinates) {
                   console.warn(`parseGeographies (labels): Layer for key "${key}" is a single geometry, not a GeometryCollection. Wrapping it.`)
                   return [layer as GeoJSON.Geometry];
                }
                console.error(`parseGeographies (labels): Layer for key "${key}" is not a GeometryCollection and does not have a 'geometries' array, nor is it a recognized single geometry. Layer type:`, layer.type);
                return [];
            }}
          >
            {({ geographies }) =>
                geographies.map((geo: ExtendedFeature) => {
                    const currentProperties = geo.properties || {};
                    const provinceName = currentProperties?.name || currentProperties?.ADM1_EN || "Unknown Province";
                    const centroid = geo.centroid;

                    if (!centroid || !provinceName) return null;

                    let fontSize = 6;
                    if (provinceName.includes("Kathmandu") || provinceName.includes("Pokhara") || provinceName.includes("Lumbini")) {
                        fontSize = provinceName.includes("Kathmandu") ? 9 : 7;
                    } else if (["Bagmati", "Gandaki", "Koshi"].some(p => provinceName.includes(p))) {
                        fontSize = provinceName.includes("Bagmati") ? 7 : 6.5;
                    }
                    if (provinceName.length > 15) fontSize = 5;


                    return (
                        <Marker key={`label-${geo.rsmKey || provinceName}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={0}
                                fontSize={fontSize}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground/80 dark:fill-gray-200 font-medium pointer-events-none select-none"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                            >
                                {provinceName.replace(" Province", "").replace(" Pradesh", "")}
                            </text>
                        </Marker>
                    );
                })
            }
          </Geographies>

          {majorCities.map((cityPreset) => {
            const cityInfoFromDb = cityDetails[cityPreset.id];
            const cityToDisplay: CityMapData = cityInfoFromDb
              ? { ...cityPreset, ...cityInfoFromDb, type: 'City' } // Merge, ensuring type is City
              : { ...cityPreset, type: 'City', description: `Explore ${cityPreset.name}.`, link: `/districts?name=${encodeURIComponent(cityPreset.name)}` }; // Fallback

            const isSelected = selectedFeatureInfo?.feature.id === cityToDisplay.id && selectedFeatureInfo?.feature.type === 'City';
            let labelFontSize = 6;
            if (cityToDisplay.name === "Kathmandu") labelFontSize = 9;
            else if (["Pokhara", "Lumbini"].includes(cityToDisplay.name)) labelFontSize = 7;


            return (
              <Marker
                key={cityToDisplay.id}
                coordinates={cityToDisplay.coordinates}
                onClick={(event: any) => {
                    console.log("City marker clicked:", cityToDisplay.name, "Event pageX:", event.pageX, "pageY:", event.pageY);
                    handleFeatureClick(cityToDisplay, event);
                }}
              >
                 <g
                  className={`cursor-pointer transition-all duration-150 group`}
                >
                  <circle
                    r={isSelected ? 6 : 4}
                    className={isSelected
                        ? 'fill-accent stroke-accent-foreground dark:fill-accent dark:stroke-accent-foreground'
                        : 'fill-primary stroke-primary-foreground group-hover:fill-accent group-hover:stroke-accent-foreground'}
                    strokeWidth={0.75}
                  />
                </g>
                <text
                  textAnchor="middle"
                  y={-8}
                  fontSize={labelFontSize}
                  className={`select-none pointer-events-none transition-opacity duration-150
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/90 dark:fill-gray-200 group-hover:opacity-100 group-hover:fill-accent'}`}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                >
                  {cityToDisplay.name}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

    {selectedFeatureInfo && mapContainerRef.current && (
        <Card
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[60] transition-all duration-200 ease-out"
             style={{
                left: `${selectedFeatureInfo.pageX + 15}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                transform: selectedFeatureInfo.pageX > (mapContainerRef.current.offsetWidth || window.innerWidth) - ( (mapContainerRef.current.offsetWidth || window.innerWidth) > 768 ? 288 + 30 : 256 + 30)
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
            {(selectedFeatureInfo.feature.description || typeof selectedFeatureInfo.feature.population === 'number') && (
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
                 {!selectedFeatureInfo.feature.description && isLoadingDetails && (
                    <p className="text-muted-foreground/70 text-xs italic">Loading details...</p>
                 )}
                 {!selectedFeatureInfo.feature.description && !isLoadingDetails && fetchError && fetchError.includes("Firebase") && (
                    <p className="text-destructive/80 text-xs italic">Details from database currently unavailable.</p>
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
    {isLoadingDetails && !isLoadingMapGeometry && (
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}

