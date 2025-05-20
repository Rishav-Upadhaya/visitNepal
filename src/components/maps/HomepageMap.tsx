
"use client";

import type { LegacyRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology } from 'topojson-client'; // Corrected type Objects import

const TOPOJSON_OBJECT_KEY = "nepal"; // This MUST match the object layer name in your TopoJSON file
const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Path to your TopoJSON file in /public/data/

interface ExtendedProvinceMapData extends ProvinceMapData {
  id: string; // Ensure id is always present
  type: 'Province';
}

interface ExtendedCityMapData extends CityMapData {
  id: string; // Ensure id is always present
  type: 'City';
}
interface SelectedFeatureDisplayInfo {
  feature: ExtendedProvinceMapData | ExtendedCityMapData;
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
  rsmKey: string;
  // centroid?: [number, number]; // react-simple-maps might add this
}


export function HomepageMap() {
  const [mapData, setMapData] = useState<Topology | null>(null);
  const [provinceDetails, setProvinceDetails] = useState<Record<string, ProvinceMapData>>({});
  const [cityDetails, setCityDetails] = useState<Record<string, CityMapData>>({});
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);

  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true); // Separate loading for Firestore data
  const [fetchError, setFetchError] = useState<string | null>(null);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const majorCities: Omit<CityMapData, 'population' | 'description' | 'link' | 'type'>[] = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], highlight: true },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], highlight: true },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], highlight: true },
  ];

  // Fetch TopoJSON and Firestore data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setIsLoadingDetails(true);
      setFetchError(null);

      // Fetch TopoJSON map geometry
      try {
        console.log(`HomepageMap: Fetching map geometry from ${NEPAL_GEO_URL}...`);
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 500)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
        const rawMapData: any = await geoRes.json();
        console.log("HomepageMap: Raw map data fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");


        if (rawMapData.type === 'Topology' && typeof rawMapData.objects === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          setMapData(rawMapData);
          console.log(`HomepageMap: TopoJSON map geometry data seems valid and set. Object key for geometries: ${TOPOJSON_OBJECT_KEY}`);
        } else {
          const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
        }
      } catch (err) {
        console.error("HomepageMap: Error fetching or parsing map geometry:", err);
        const specificError = err instanceof Error ? err.message : "An unknown error occurred while fetching map geometry.";
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }

      // Fetch details from Firestore
      if (!db) {
         const firestoreError = "Firebase Firestore (db instance) is not available. Check Firebase initialization in src/lib/firebase.ts and ensure all NEXT_PUBLIC_FIREBASE_... environment variables are correctly set.";
         console.error("HomepageMap:", firestoreError);
         setFetchError(prev => prev ? `${prev}\n${firestoreError}` : firestoreError);
         setIsLoadingDetails(false);
         return;
      }

      try {
        console.log("HomepageMap: Starting Firestore details fetch...");
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const pDetails: Record<string, ProvinceMapData> = {};
        provincesSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const key = (data.id_key || docSnap.id).toLowerCase().replace(/\s+/g, '_');
          pDetails[key] = { ...data, id: docSnap.id, type: 'Province' } as ProvinceMapData;
        });
        setProvinceDetails(pDetails);
        console.log("HomepageMap: Province details fetched:", Object.keys(pDetails).length);

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
             cDetails[city.id] = {...city, type: 'City', description: `Explore ${city.name}.`, link: `/districts?name=${encodeURIComponent(city.name)}`};
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
        setFetchError(prev => prev ? `${prev}\n${specificError}` : specificError);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed db from dependencies


  const handleFeatureClick = useCallback((
    featureData: ExtendedProvinceMapData | ExtendedCityMapData,
    event: React.MouseEvent<SVGElement | SVGGElement>
  ) => {
    event.stopPropagation();
    console.log("Feature Clicked:", featureData.name, "at X:", event.pageX, "Y:", event.pageY);
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
  if (fetchError) {
    if (fetchError.includes("offline") || fetchError.includes("Failed to get document")) {
      displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
    } else if (fetchError.includes("Invalid map data structure")) {
      displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}'). Check console for details.`;
    }
  }


  if (isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map Geometry...</p>
      </div>
    );
  }

  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable."}</p>
      </div>
    );
  }

  if (!mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY]) {
     const missingLayerError = `HomepageMap: Critical error - Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Expected 'objects.${TOPOJSON_OBJECT_KEY}' to exist. Available objects: ${mapData.objects ? Object.keys(mapData.objects).join(', ') : 'N/A'}`;
    console.error(missingLayerError);
    return (
        <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
            <Globe className="h-10 w-10 mb-2" />
            <p className="font-semibold text-lg mb-1">Map Data Layer Error</p>
            <p className="text-sm">{missingLayerError}</p>
        </div>
    );
  }


  return (
    <div
      ref={mapContainerRef}
      className="relative w-full aspect-[16/9] bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={closeInfoBox} // Close info box if map background is clicked
    >
        {/* Debug Text for State */}
        {/* <div className="fixed top-0 left-0 bg-yellow-200 text-black p-1 z-[100000] text-xs">
            Selected: {selectedFeatureInfo ? selectedFeatureInfo.feature.name : 'None'} | Coords: {selectedFeatureInfo ? `${selectedFeatureInfo.pageX},${selectedFeatureInfo.pageY}` : 'N/A'}
        </div> */}

       <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 2800, // Adjusted scale
          center: [84.1240, 28.3949] // Center of Nepal
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing provinces and major cities"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
          {/* Layer for Province Shapes */}
          <Geographies
            geography={mapData} // Pass the full TopoJSON object
            parseGeographies={data => {
                // This function extracts the 'geometries' array from the correct layer in TopoJSON
                console.log("parseGeographies called for shapes. TOPOJSON_OBJECT_KEY:", TOPOJSON_OBJECT_KEY);
                if (!data || typeof data.objects !== 'object' || data.objects === null) {
                  console.error("parseGeographies (shapes): Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                  return [];
                }
                const key = TOPOJSON_OBJECT_KEY;
                if (!key || !data.objects[key]) {
                  console.error(`parseGeographies (shapes): Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                  return [];
                }
                const layer = data.objects[key];
                if (layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                  return layer.geometries;
                }
                if (["Polygon", "MultiPolygon"].includes(layer.type) && layer.arcs) { // Check for arcs for single geometry
                   console.warn(`parseGeographies (shapes): Layer for key "${key}" is a single geometry. Wrapping it.`)
                   return [layer as unknown as ExtendedFeature]; // react-simple-maps expects Feature-like objects here
                }
                console.error(`parseGeographies (shapes): Layer for key "${key}" is not a GeometryCollection and does not have 'geometries' or recognized 'arcs'. Layer type:`, layer.type);
                return [];
            }}
          >
            {({ geographies }) =>
              geographies.map((geo: ExtendedFeature) => {
                const currentProperties = geo.properties || {};
                // Prioritize more specific district/province names if available
                const provinceName = currentProperties?.name || currentProperties?.DIST_EN || currentProperties?.ADM1_EN || "Unknown Province";
                const detailsKey = provinceName.toLowerCase().replace(/\s+/g, '_');
                const firestoreDetails = provinceDetails[detailsKey];
                const isSelected = selectedFeatureInfo?.feature.id === geo.rsmKey && selectedFeatureInfo.feature.type === 'Province';

                const featureDataForInfoBox: ExtendedProvinceMapData = {
                  id: geo.rsmKey || String(currentProperties?.id || Math.random()),
                  name: firestoreDetails?.name || provinceName,
                  type: 'Province',
                  population: firestoreDetails?.population,
                  description: firestoreDetails?.description || `Explore the ${provinceName}.`,
                  link: firestoreDetails?.link || `/districts?name=${encodeURIComponent(provinceName)}`,
                  properties: currentProperties
                };

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(featureDataForInfoBox, event)}
                    className={
                      `transition-all duration-150 ease-out outline-none
                       ${isSelected
                            ? 'fill-accent/70 dark:fill-accent/60 stroke-accent-foreground dark:stroke-accent-foreground/80 stroke-[1.5px]'
                            : 'fill-white dark:fill-gray-700 stroke-gray-400 dark:stroke-gray-500 stroke-[0.5px] hover:fill-accent/30 dark:hover:fill-accent/20 cursor-pointer'
                       }`
                    }
                    aria-label={provinceName}
                  />
                );
              })
            }
          </Geographies>

          {/* Layer for Province Labels */}
          <Geographies
              geography={mapData}
              parseGeographies={data => {
                  console.log("parseGeographies called for labels. TOPOJSON_OBJECT_KEY:", TOPOJSON_OBJECT_KEY);
                  if (!data || typeof data.objects !== 'object' || data.objects === null) {
                    console.error("parseGeographies (labels): Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                    return [];
                  }
                  const key = TOPOJSON_OBJECT_KEY;
                  if (!key || !data.objects[key]) {
                    console.error(`parseGeographies (labels): Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                    return [];
                  }
                  const layer = data.objects[key];
                   if (layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                    return layer.geometries;
                  }
                  if (["Polygon", "MultiPolygon"].includes(layer.type) && layer.arcs) {
                     console.warn(`parseGeographies (labels): Layer for key "${key}" is a single geometry. Wrapping it.`)
                     return [layer as unknown as ExtendedFeature];
                  }
                  console.error(`parseGeographies (labels): Layer for key "${key}" is not a GeometryCollection and does not have 'geometries' or 'arcs'. Layer type:`, layer.type);
                  return [];
              }}
            >
              {({ geographies }) =>
                  geographies.map((geo: ExtendedFeature) => {
                      const currentProperties = geo.properties || {};
                      const provinceName = currentProperties?.name || currentProperties?.DIST_EN || currentProperties?.ADM1_EN || "";
                      const centroid = (geo as any).centroid; // react-simple-maps should provide this

                      if (!centroid || !provinceName) return null;

                      let fontSize = 5; // Default smaller size
                      if (["Kathmandu", "Pokhara", "Lumbini"].some(c => provinceName.includes(c))) {
                          fontSize = provinceName.includes("Kathmandu") ? 7 : 6;
                      } else if (["Bagmati", "Gandaki", "Koshi", "Lumbini Province"].some(p => provinceName.includes(p))) {
                          fontSize = provinceName.includes("Bagmati") || provinceName.includes("Lumbini Province") ? 6 : 5.5;
                      }
                      if (provinceName.length > 15) fontSize = Math.max(3.5, fontSize - 1.5);
                      if (provinceName.length > 20) fontSize = Math.max(3, fontSize - 1);


                      return (
                          <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
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

          {/* Layer for Major City Markers */}
          {majorCities.map((cityPreset) => {
            const cityInfoFromDb = cityDetails[cityPreset.id];
            const cityToDisplay: ExtendedCityMapData = cityInfoFromDb
              ? { ...cityPreset, ...cityInfoFromDb, type: 'City' }
              : { ...cityPreset, type: 'City', description: `Explore ${cityPreset.name}.`, link: `/districts?name=${encodeURIComponent(cityPreset.name)}` };

            const isSelected = selectedFeatureInfo?.feature.id === cityToDisplay.id && selectedFeatureInfo?.feature.type === 'City';
            let labelFontSize = 6;
            if (cityToDisplay.name === "Kathmandu") labelFontSize = 7;
            else if (["Pokhara", "Lumbini"].includes(cityToDisplay.name)) labelFontSize = 6;


            return (
              <Marker
                key={cityToDisplay.id}
                coordinates={cityToDisplay.coordinates}
                onClick={(event: any) => handleFeatureClick(cityToDisplay, event)}
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
                  y={-8} // Position text above the circle
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

    {/* Info Box */}
    {selectedFeatureInfo && mapContainerRef.current && (
        <Card
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[1001] transition-all duration-200 ease-out"
            style={{
                left: `${selectedFeatureInfo.pageX + 15}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                // Adjust if too close to the right edge
                transform: selectedFeatureInfo.pageX > (mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 + 30 : 256 + 30))
                                ? 'translateX(calc(-100% - 30px))'
                                : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent map click from closing it
        >
            <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-base font-semibold leading-tight flex items-center text-primary">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                    {selectedFeatureInfo.feature.type && <p className="text-xs text-muted-foreground pt-0.5 pl-[1.375rem]">{selectedFeatureInfo.feature.type}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" onClick={closeInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
            {(selectedFeatureInfo.feature.description || typeof selectedFeatureInfo.feature.population === 'number' || isLoadingDetails) && (
                <CardContent className="p-3 text-xs space-y-1">
                {isLoadingDetails && selectedFeatureInfo.feature.type === 'Province' && !provinceDetails[(selectedFeatureInfo.feature as ExtendedProvinceMapData).id_key || selectedFeatureInfo.feature.id.toLowerCase().replace(/\s+/g, '_')] && (
                     <p className="text-muted-foreground/70 text-xs italic flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Loading details...</p>
                )}
                {isLoadingDetails && selectedFeatureInfo.feature.type === 'City' && !cityDetails[selectedFeatureInfo.feature.id] && (
                     <p className="text-muted-foreground/70 text-xs italic flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Loading details...</p>
                )}

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
                {!selectedFeatureInfo.feature.description && !isLoadingDetails && fetchError && fetchError.includes("Firebase") && (
                    <p className="text-destructive/80 text-xs italic">Details from database currently unavailable.</p>
                )}
                 {!selectedFeatureInfo.feature.description && !isLoadingDetails && !fetchError && (
                     <p className="text-muted-foreground/70 text-xs italic">No description available.</p>
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
