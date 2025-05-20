
"use client";

import type { LegacyRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe } from 'lucide-react';
import { feature as topojsonFeature } from 'topojson-client';
import type { Topology, Objects } from 'topojson-specification';

// This key MUST match the object layer name in your TopoJSON file that contains the province/district geometries.
const TOPOJSON_OBJECT_KEY = "nepal"; // Assuming your TopoJSON layer is named "nepal"
const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; 

interface SelectedFeatureDisplayInfo {
  feature: ProvinceMapData | CityMapData;
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [rawTopoJson, setRawTopoJson] = useState<Topology | null>(null); // Stores the raw TopoJSON
  const [mapFeatures, setMapFeatures] = useState<ExtendedFeature[] | null>(null); // Stores GeoJSON features
  
  const [provinceDetails, setProvinceDetails] = useState<Record<string, ProvinceMapData>>({});
  const [cityDetails, setCityDetails] = useState<Record<string, CityMapData>>({});
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);
  
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true); // Separate loading for Firestore details
  const [mapGeometryError, setMapGeometryError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null); // Separate error for Firestore details

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const majorCities: Omit<CityMapData, 'population' | 'description' | 'link'>[] = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', highlight: true },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', highlight: true },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', highlight: true },
  ];

  useEffect(() => {
    const fetchMapGeometry = async () => {
      setIsLoadingMapGeometry(true);
      setMapGeometryError(null);
      console.log("HomepageMap: Starting TopoJSON geometry fetch...");
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`);
        }
        const jsonData = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON fetched. Sample:", JSON.stringify(jsonData, null, 2).substring(0, 300) + "...");

        if (jsonData.type !== 'Topology' || typeof jsonData.objects !== 'object' || !jsonData.objects[TOPOJSON_OBJECT_KEY]) {
          const errorMsg = `Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Expected 'type: \"Topology\"' and an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(jsonData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
        
        setRawTopoJson(jsonData as Topology); // Store raw TopoJSON for react-simple-maps
        console.log(`HomepageMap: TopoJSON map geometry data seems valid and set. Object key for geometries: ${TOPOJSON_OBJECT_KEY}`);
        
      } catch (err) {
        console.error("HomepageMap: Error fetching or parsing map geometry:", err);
        const specificError = err instanceof Error ? err.message : "An unknown error occurred while fetching map geometry.";
        setMapGeometryError(specificError);
        setRawTopoJson(null);
      } finally {
        setIsLoadingMapGeometry(false);
        console.log("HomepageMap: Map geometry fetching finished.");
      }
    };

    const fetchDetailsFromFirestore = async () => {
      if (!db) {
        const errorMsg = "Firebase Firestore (db instance) is not available. This usually means Firebase failed to initialize. Check console for errors in src/lib/firebase.ts, and verify ALL NEXT_PUBLIC_FIREBASE_... environment variables are correctly set.";
        console.warn("HomepageMap: fetchDetailsFromFirestore:", errorMsg);
        setDetailsError(errorMsg); // Set details error but don't block map rendering
        setIsLoadingDetails(false);
        return;
      }

      setIsLoadingDetails(true);
      setDetailsError(null);
      console.log("HomepageMap: Starting Firestore details fetch...");
      try {
        // Fetch province details
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const pDetails: Record<string, ProvinceMapData> = {};
        provincesSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<ProvinceMapData, 'id' | 'type'>;
          const key = (data.id_key || docSnap.id).toLowerCase().replace(/\s+/g, '_'); // Assuming an 'id_key' field or using doc.id
          pDetails[key] = { ...data, id: docSnap.id, type: 'Province' };
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
                ...city, 
                ...(cityDocSnap.data() as Partial<Omit<CityMapData, 'id' | 'coordinates' | 'type'>>), 
                type: 'City' 
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
          specificError = err.message;
           if (err.message.includes("offline") || err.message.includes("Failed to get document")) {
            specificError = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${err.message}`;
          }
        }
        setDetailsError(specificError);
      } finally {
        setIsLoadingDetails(false);
        console.log("HomepageMap: Firestore details fetching finished.");
      }
    };
    
    fetchMapGeometry();
    fetchDetailsFromFirestore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleFeatureClick = useCallback((
    featureData: ProvinceMapData | CityMapData,
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


  if (isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map Geometry...</p>
      </div>
    );
  }
  
  if (mapGeometryError || !rawTopoJson) {
    let displayErrorMessage = mapGeometryError;
    if (mapGeometryError && (mapGeometryError.toLowerCase().includes("404") || mapGeometryError.toLowerCase().includes("failed to fetch"))) {
        displayErrorMessage = `Map Error: Failed to load map geometry from ${NEPAL_GEO_URL}. Please ensure the file exists in public/data and the path is correct. Original: ${mapGeometryError}`;
    } else if (!rawTopoJson && !mapGeometryError) {
        displayErrorMessage = "Map geometry data is currently unavailable. Please try again shortly.";
    }
    console.error("HomepageMap: Rendering error component. mapGeometryError:", displayErrorMessage, "rawTopoJson valid:", !!rawTopoJson);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <Globe className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Geometry Error</p>
        <p className="text-sm">{displayErrorMessage}</p>
      </div>
    );
  }

  // Check if the main TopoJSON object and the specific layer exist
  if (!rawTopoJson.objects || !rawTopoJson.objects[TOPOJSON_OBJECT_KEY]) {
    const errorMsg = `HomepageMap: Critical error - Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Expected 'objects.${TOPOJSON_OBJECT_KEY}' to exist. Available objects: ${rawTopoJson.objects ? Object.keys(rawTopoJson.objects).join(', ') : 'N/A'}`;
    console.error(errorMsg);
    return (
        <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
            <InfoIcon className="h-10 w-10 mb-2" />
            <p className="font-semibold text-lg mb-1">Map Data Error</p>
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
            geography={rawTopoJson} 
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
                const currentProperties = geo.properties as ProvinceMapData['properties'] || {};
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
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(featureDataForInfoBox, event)}
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
            geography={rawTopoJson}
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
                    const currentProperties = geo.properties as ProvinceMapData['properties'] || {};
                    const provinceName = currentProperties?.name || currentProperties?.ADM1_EN || "Unknown Province";
                    const centroid = (geo as any).centroid as [number, number] | undefined; 
                    
                    if (!centroid || !provinceName) return null;

                    let fontSize = 5;
                    if (["Kathmandu", "Pokhara", "Lumbini"].some(p => provinceName.includes(p))) { // This applies to province names if they include city names
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
            const cityInfo = cityDetails[cityPreset.id] || cityPreset;
            const featureDataForInfoBox: CityMapData = {
                ...cityInfo,
                type: 'City',
                link: cityInfo.link || `/districts?name=${encodeURIComponent(cityInfo.name)}`, // Default link
                description: cityInfo.description || `Explore ${cityInfo.name}.`
            };
            const isSelected = selectedFeatureInfo?.feature.id === cityPreset.id && selectedFeatureInfo?.feature.type === 'City';
            
            let labelFontSize = 6;
            let pinSize = 10;
            if (["Kathmandu", "Pokhara"].includes(cityPreset.name)) {
                labelFontSize = 7;
                pinSize = 12;
            } else if (cityPreset.name === "Lumbini") {
                labelFontSize = 6.5;
                pinSize = 11;
            }

            return (
              <Marker 
                key={cityPreset.id} 
                coordinates={cityPreset.coordinates} 
                onClick={(event: any) => handleFeatureClick(featureDataForInfoBox, event )}
              >
                 <g
                  className={`cursor-pointer transition-all duration-150 ease-out group`}
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
                  y={-8} // Adjusted for circle marker
                  fontSize={labelFontSize}
                  className={`select-none pointer-events-none transition-opacity duration-150
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/90 dark:fill-gray-200 group-hover:opacity-100 group-hover:fill-accent'}`}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                >
                  {cityPreset.name}
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
                transform: selectedFeatureInfo.pageX > mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 + 30 : 256 + 30) 
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
                 {!selectedFeatureInfo.feature.description && detailsError && (
                    <p className="text-destructive/80 text-xs italic">Details from database currently unavailable. {detailsError.includes("offline") ? "Check connection." : ""}</p>
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
     {detailsError && (
        <div className="absolute bottom-2 left-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-md flex items-center gap-2 z-50">
            <InfoIcon className="h-3 w-3" />
            Map details error: {detailsError.length > 100 ? detailsError.substring(0,100) + "..." : detailsError}
        </div>
    )}
    </div>
  );
}
