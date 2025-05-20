
"use client";

import type { ExtendedFeature, ExtendedProvinceMapData, ExtendedCityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react'; // Added Loader2
import { feature as topojsonFeature, type Topology } from 'topojson-client';

const TOPOJSON_OBJECT_KEY = "nepal"; // This should match the layer name in your TopoJSON file
const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";

interface SelectedFeatureDisplayInfo {
  feature: ExtendedProvinceMapData | ExtendedCityMapData;
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null); // Stores array of GeoJSON features
  const [provinceDetails, setProvinceDetails] = useState<Record<string, ExtendedProvinceMapData>>({});
  const [cityDetails, setCityDetails] = useState<Record<string, ExtendedCityMapData>>({});
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const majorCities: Array<Omit<ExtendedCityMapData, 'population' | 'description' | 'link' | 'type'>> = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], highlight: true },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], highlight: true },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], highlight: true },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setIsLoadingDetails(true);
      setFetchError(null);
      let rawMapData: Topology | null = null;

      // Fetch TopoJSON map geometry
      try {
        console.log(`HomepageMap: Fetching map geometry from ${NEPAL_GEO_URL}...`);
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0,500)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
        rawMapData = await geoRes.json() as Topology;
        console.log("HomepageMap: Raw TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");

        if (rawMapData && typeof rawMapData.objects === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          if (layer) {
            // Convert TopoJSON layer to GeoJSON features
            const geoJsonFeatures = topojsonFeature(rawMapData, layer!).features as ExtendedFeature[];
            setMapData(geoJsonFeatures);
            console.log(`HomepageMap: TopoJSON processed into ${geoJsonFeatures.length} GeoJSON features.`);
          } else {
             const errorMsg = `Invalid TopoJSON structure: Layer key "${TOPOJSON_OBJECT_KEY}" not found in objects. Available keys: ${rawMapData.objects ? Object.keys(rawMapData.objects).join(', ') : 'N/A'}`;
             console.error("HomepageMap:", errorMsg);
             setFetchError(errorMsg);
             setMapData(null);
          }
        } else {
          const errorMsg = `Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
        }
      } catch (err) {
        console.error("HomepageMap: Error fetching or processing map geometry:", err);
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
        const pDetails: Record<string, ExtendedProvinceMapData> = {};
        provincesSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const key = (data.id_key || docSnap.id).toLowerCase().replace(/\s+/g, '_');
          pDetails[key] = { ...data, id: docSnap.id, type: 'Province' } as ExtendedProvinceMapData;
        });
        setProvinceDetails(pDetails);
        console.log("HomepageMap: Province details fetched:", Object.keys(pDetails).length);

        const cDetails: Record<string, ExtendedCityMapData> = {};
        for (const city of majorCities) {
          const cityDocRef = doc(db, "nepal_major_cities_data", city.id);
          const cityDocSnap = await getDoc(cityDocRef);
          if (cityDocSnap.exists()) {
            cDetails[city.id] = {
              ...city,
              ...(cityDocSnap.data() as Partial<Omit<ExtendedCityMapData, 'id' | 'name' | 'coordinates' | 'type'>>),
              type: 'City'
            } as ExtendedCityMapData;
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
        if (err instanceof Error && (err.message.includes("offline") || err.message.includes("Failed to get document"))) {
          specificError = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${err.message}`;
        } else if (err instanceof Error) {
          specificError = `Firebase Firestore error: ${err.message}`;
        }
        setFetchError(prev => prev ? `${prev}\n${specificError}` : specificError);
      } finally {
        setIsLoadingDetails(false);
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

  // Debug log for selected feature
  useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);

  let displayErrorMessage = fetchError;

  if (isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map Geometry...</p>
      </div>
    );
  }

  if (displayErrorMessage || !mapData) {
      if (fetchError?.includes("offline") || fetchError?.includes("Failed to get document")) {
        displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
      } else if (fetchError?.includes("Invalid TopoJSON structure") || fetchError?.includes("Invalid GeoJSON data structure")) {
         displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid (TopoJSON for this setup), and contains the expected layer ('${TOPOJSON_OBJECT_KEY}'). Original: ${fetchError}`;
      }
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable."}</p>
      </div>
    );
  }


  return (
    <div
      ref={mapContainerRef}
      className="relative w-full aspect-[16/9] bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={closeInfoBox}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 1000, background: 'rgba(255,255,0,0.7)', padding: '5px', color: 'black' }}>
        {selectedFeatureInfo ? `DEBUG Info: ${selectedFeatureInfo.feature.name} at ${selectedFeatureInfo.pageX},${selectedFeatureInfo.pageY}` : "DEBUG: Click a feature"}
      </div>

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
            geography={mapData} // mapData is now an array of GeoJSON features
          >
            {({ geographies }) =>
              geographies.map((geo: ExtendedFeature) => {
                const provinceName = geo.properties?.name || geo.properties?.ADM1_EN || geo.properties?.DIST_EN || "Unknown Area";
                const geoId = String(geo.id || geo.properties?.id || geo.rsmKey || provinceName + Math.random());
                const detailsKey = provinceName.toLowerCase().replace(/\s+/g, '_');
                const firestoreDetails = provinceDetails[detailsKey];

                const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === 'Province';

                const featureDataForInfoBox: ExtendedProvinceMapData = {
                  id: geoId,
                  name: firestoreDetails?.name || provinceName,
                  type: 'Province',
                  population: firestoreDetails?.population,
                  description: firestoreDetails?.description || `Explore ${provinceName}.`,
                  link: firestoreDetails?.link || `/districts?name=${encodeURIComponent(provinceName)}`,
                  properties: geo.properties || {}
                };

                return (
                  <Geography
                    key={geoId}
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(featureDataForInfoBox, event)}
                    className={
                      `transition-all duration-150 ease-out outline-none
                       ${isSelected
                            ? 'fill-accent/70 dark:fill-accent/60 stroke-accent-foreground dark:stroke-accent-foreground/80 stroke-[1.5px]'
                            : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-500 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer'
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
            geography={mapData} // mapData is an array of GeoJSON features
          >
            {({ geographies }) =>
                geographies.map((geo: ExtendedFeature) => {
                    const provinceName = geo.properties?.name || geo.properties?.ADM1_EN || geo.properties?.DIST_EN || "";
                    // react-simple-maps might not directly provide 'centroid' for plain GeoJSON features in the same way as TopoJSON.
                    // For simplicity, we might omit complex label positioning or use a simpler approach if centroids are not available.
                    // If you have centroids in your GeoJSON properties, you could use them here.
                    // For now, this part might not render labels effectively without centroid calculation or properties.
                    const centroid = (geo as any).centroid; // Attempt to access if react-simple-maps populates it

                    if (!centroid || !provinceName) return null;

                    let fontSize = 5;
                    if (["Bagmati", "Gandaki", "Koshi", "Lumbini Province"].some(p => provinceName.includes(p))) {
                        fontSize = provinceName.includes("Bagmati") || provinceName.includes("Lumbini Province") ? 6 : 5.5;
                    }
                    if (provinceName.length > 15) fontSize = Math.max(3.5, fontSize - 1.5);
                    if (provinceName.length > 20) fontSize = Math.max(3, fontSize - 1);


                    return (
                        <Marker key={`label-${geo.id || geo.rsmKey}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={0}
                                fontSize={fontSize}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground dark:fill-background pointer-events-none select-none"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--background)) dark:hsl(var(--foreground))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
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
            let yOffset = -8;
            if (cityToDisplay.name === "Kathmandu") {
              labelFontSize = 7;
              yOffset = -9;
            } else if (["Pokhara", "Lumbini"].includes(cityToDisplay.name)) {
              labelFontSize = 6;
              yOffset = -8;
            }


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
                        : 'fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground'}
                    strokeWidth={0.75}
                  />
                </g>
                <text
                  textAnchor="middle"
                  y={yOffset}
                  fontSize={labelFontSize}
                  className={`select-none pointer-events-none transition-opacity duration-150
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent'}`}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background)) dark:hsl(var(--foreground))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
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
                transform: selectedFeatureInfo.pageX > (mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 + 30 : 256 + 30))
                                ? 'translateX(calc(-100% - 30px))'
                                : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()}
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
            {(selectedFeatureInfo.feature.description || typeof selectedFeatureInfo.feature.population === 'number' || (isLoadingDetails && !provinceDetails[(selectedFeatureInfo.feature as ExtendedProvinceMapData).id_key || selectedFeatureInfo.feature.id.toLowerCase().replace(/\s+/g, '_')])) && (
                <CardContent className="p-3 text-xs space-y-1">
                {isLoadingDetails && !provinceDetails[(selectedFeatureInfo.feature as ExtendedProvinceMapData).id_key || selectedFeatureInfo.feature.id.toLowerCase().replace(/\s+/g, '_')] && !cityDetails[selectedFeatureInfo.feature.id] && (
                     <p className="text-muted-foreground/70 text-xs italic flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Loading details...</p>
                )}

                {typeof selectedFeatureInfo.feature.population === 'number' && (
                    <p className="text-muted-foreground">
                    <span className="font-medium text-foreground/90">Population:</span> {Number(selectedFeatureInfo.feature.population).toLocaleString()}
                    </p>
                )}
                {selectedFeatureInfo.feature.description && (
                    <CardDescription className="text-xs text-muted-foreground line-clamp-3 !mt-1">
                      {selectedFeatureInfo.feature.description}
                    </CardDescription>
                )}
                 {!selectedFeatureInfo.feature.description && !isLoadingDetails && fetchError && (fetchError.includes("Firebase") || fetchError.includes("offline")) && (
                    <p className="text-destructive/80 text-xs italic">Detailed information currently unavailable due to a connection issue.</p>
                )}
                 {!selectedFeatureInfo.feature.description && !isLoadingDetails && !fetchError && (
                     <p className="text-muted-foreground/70 text-xs italic">No description available for this location.</p>
                 )}
                </CardContent>
            )}
            {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 border-t pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs text-accent-foreground border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
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
