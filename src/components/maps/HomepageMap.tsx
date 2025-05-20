
"use client";

import type { LegacyRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase'; // Ensure db is imported
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, InfoIcon, XIcon, Globe } from 'lucide-react';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';


const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // THIS MUST MATCH THE MAIN LAYER NAME IN YOUR TopoJSON file

interface SelectedFeatureDisplayInfo {
  feature: ProvinceMapData | CityMapData; // Use specific types
  pageX: number;
  pageY: number;
}

// Define an extended type for features that includes the rsmKey if needed
interface RSMFeature extends ExtendedFeature {
  rsmKey?: string;
}


export function HomepageMap() {
  const [mapData, setMapData] = useState<Topology | null>(null);
  const [provinceDetails, setProvinceDetails] = useState<Record<string, ProvinceMapData>>({});
  const [cityDetails, setCityDetails] = useState<Record<string, CityMapData>>({});
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);


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

      // Check if db is initialized
      if (!db) {
          const errorMsg = "Firebase Firestore is not initialized. Please check your Firebase configuration and ensure all NEXT_PUBLIC_FIREBASE_... environment variables are correctly set.";
          console.error("HomepageMap: ", errorMsg);
          setFetchError(errorMsg);
          setIsLoading(false);
          return;
      }

      try {
        // Fetch TopoJSON for map geography
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const rawMapData: Topology = await geoRes.json();
         if (!rawMapData || typeof rawMapData.objects !== 'object' || !rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
            const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
            console.error("HomepageMap:", errorMsg);
            setFetchError(errorMsg);
            setMapData(null); // Explicitly set to null on error
            setIsLoading(false);
            return;
        }
        setMapData(rawMapData);
        console.log("HomepageMap: TopoJSON map data fetched successfully.");

        // Fetch province details from Firestore
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const details: Record<string, ProvinceMapData> = {};
        provincesSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as ProvinceMapData; // Cast to ProvinceMapData
          const key = (data.id || data.name || docSnap.id).toLowerCase().replace(/\s+/g, '_');
          details[key] = { ...data, id: docSnap.id, type: 'Province' };
        });
        setProvinceDetails(details);
        console.log("HomepageMap: Province details fetched:", Object.keys(details).length);

        // Fetch/Merge major city details from Firestore
        const cityDetailsData: Record<string, CityMapData> = {};
         for (const city of majorCities) {
            const cityDocRef = doc(db, "nepal_major_cities_data", city.id);
            const cityDocSnap = await getDoc(cityDocRef);
            if (cityDocSnap.exists()) {
                cityDetailsData[city.id] = { ...city, ...(cityDocSnap.data() as Partial<CityMapData>), id: city.id, type: 'City' } as CityMapData;
            } else {
                cityDetailsData[city.id] = {...city, type: 'City'}; // Use default city data if not in Firestore
            }
        }
        setCityDetails(cityDetailsData);
        console.log("HomepageMap: City details fetched/merged:", Object.keys(cityDetailsData).length);


      } catch (err) {
        console.error("HomepageMap: Error during data fetching process:", err);
        let specificError = "An unknown error occurred while fetching map data.";
        if (err instanceof Error) {
          specificError = err.message;
        }

        if (specificError.includes("offline") || specificError.includes("Failed to get document")) {
            specificError = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${specificError}`;
        } else if (specificError.includes(NEPAL_GEO_URL) && (specificError.includes("404") || specificError.includes("Not Found"))) {
             specificError = `Map geometry file (${NEPAL_GEO_URL}) not found. Ensure it's in the public/data directory and the path is correct.`;
        } else if (specificError.includes("Invalid map data structure") || specificError.includes(TOPOJSON_OBJECT_KEY)) {
             specificError = `The map data file (${NEPAL_GEO_URL}) has an invalid structure or the expected layer ('${TOPOJSON_OBJECT_KEY}') is missing/malformed. Please verify the TopoJSON file.`;
        }
        setFetchError(specificError);
        setMapData(null); // Ensure mapData is null if fetching fails
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: Data fetching finished.");
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFeatureClick = useCallback((
    featureData: ProvinceMapData | CityMapData,
    event: React.MouseEvent<SVGElement | SVGGElement>
  ) => {
    event.stopPropagation();
    console.log("Feature Clicked:", featureData.name, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureData);
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


  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/30 dark:bg-muted/50 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map...</p>
      </div>
    );
  }

  if (fetchError || !mapData) {
    let displayErrorMessage = fetchError || "Map data is unavailable. Please try again later.";
    if (fetchError && (fetchError.includes("offline") || fetchError.includes("Failed to get document") || fetchError.includes("Firebase Firestore is not initialized"))) {
      displayErrorMessage = "Could not connect to map data service. Please check your Firebase configuration (ensure NEXT_PUBLIC_FIREBASE_... variables are set in .env.local or your deployment environment) and internet connection. If the issue persists, verify the map data file path and Firestore collection names.";
    } else if (fetchError && (fetchError.includes("Invalid map data structure") || fetchError.includes(TOPOJSON_OBJECT_KEY) )) {
        displayErrorMessage = `The map data file (${NEPAL_GEO_URL}) has an invalid structure or the expected layer ('${TOPOJSON_OBJECT_KEY}') is missing/malformed. Please verify your TopoJSON file.`;
    }
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage}</p>
      </div>
    );
  }
  
  if (!mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY] || typeof (mapData.objects[TOPOJSON_OBJECT_KEY] as any).geometries === 'undefined') {
      console.error("HomepageMap: Critical error - Invalid TopoJSON structure or missing/invalid layer. Key used:", TOPOJSON_OBJECT_KEY, "Available objects:", mapData.objects);
      return (
          <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
              <Globe className="h-10 w-10 mb-2" />
              <p className="font-semibold text-lg mb-1">Map Layer Configuration Error</p>
              <p className="text-sm">The TopoJSON file is missing the expected layer named &quot;{TOPOJSON_OBJECT_KEY}&quot; or its structure is invalid. Please check the file at {NEPAL_GEO_URL} and ensure it contains a `GeometryCollection` with a `geometries` array under this key.</p>
          </div>
      );
  }

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full aspect-[16/9] bg-green-100 dark:bg-green-900/20 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={closeInfoBox} // Close info box if map background is clicked
    >
       <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 2800, // Adjust as needed for Nepal
          center: [84.1240, 28.3949] // Center of Nepal
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing provinces and major cities"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
          {/* Render Provinces */}
          <Geographies
            geography={mapData}
            parseGeographies={data => {
              // This function extracts the 'geometries' array from the correct layer in TopoJSON
              if (!data || typeof data.objects !== 'object' || data.objects === null) {
                console.error("parseGeographies: Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                return [];
              }
              const key = TOPOJSON_OBJECT_KEY; 
              if (!key || !data.objects[key]) {
                console.error(`parseGeographies: Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                return [];
              }
              const layer = data.objects[key] as any; // Cast to any to access geometries flexibly
              if (layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                return layer.geometries;
              }
              console.error(`parseGeographies: Layer for key "${key}" is not a GeometryCollection or does not have a 'geometries' array. Layer type:`, layer.type);
              return [];
            }}
          >
            {({ geographies }) =>
              geographies.map((geo: RSMFeature) => { // Use RSMFeature type
                const geoId = geo.rsmKey || geo.id || (geo.properties && (geo.properties as any).id) || String(Math.random());
                const properties = geo.properties as ProvinceMapData; // Cast for type safety
                const provinceName = properties?.name || properties?.ADM1_EN || "Unknown Province";
                
                // Attempt to get details from Firestore cache or use default
                const detailsFromState = provinceDetails[provinceName.toLowerCase().replace(/\s+/g, '_')] ||
                                         provinceDetails[geoId.toLowerCase().replace(/\s+/g, '_')] ||
                                         {name: provinceName, type: 'Province', link: `/districts?name=${encodeURIComponent(provinceName)}`, id: geoId, description: `Explore ${provinceName}.`};

                const isSelected = selectedFeatureInfo?.feature.id === detailsFromState.id && selectedFeatureInfo.feature.type === 'Province';

                return (
                  <Geography
                    key={geoId}
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(detailsFromState, event)}
                    className={
                      `transition-all duration-150 ease-out cursor-pointer
                       ${isSelected 
                            ? 'fill-accent/80 dark:fill-accent/60 stroke-accent-foreground dark:stroke-accent-foreground/80 stroke-[1.5px]'
                            : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30'
                       }`
                    }
                    aria-label={provinceName}
                  />
                );
              })
            }
          </Geographies>

          {/* Render Province Labels */}
           <Geographies
            geography={mapData}
            parseGeographies={data => {
                 if (!data || typeof data.objects !== 'object' || data.objects === null) return [];
                 const key = TOPOJSON_OBJECT_KEY;
                 if (!key || !data.objects[key]) return [];
                 const layer = data.objects[key] as any;
                 if (layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) return layer.geometries;
                 return [];
            }}
          >
            {({ geographies }) =>
                geographies.map((geo: RSMFeature) => {
                    const properties = geo.properties as ProvinceMapData;
                    const provinceName = properties?.name || properties?.ADM1_EN || "";
                    const centroid = (geo as any).centroid as [number, number] | undefined; // react-simple-maps adds centroid
                    
                    if (!centroid || !provinceName) return null;

                    // Adjust font size for specific provinces if needed
                    let fontSize = 5; // Default small font size
                    if (["Bagmati Province", "Gandaki Province", "Lumbini Province", "Koshi Province"].includes(provinceName)) {
                        fontSize = provinceName === "Bagmati Province" ? 6 : 5.5;
                    }
                     if (provinceName.length > 15) fontSize = 4; // Smaller for very long names


                    return (
                        <Marker key={`label-${geo.rsmKey || provinceName}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={0}
                                fontSize={fontSize}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground/70 dark:fill-foreground/50 font-medium pointer-events-none select-none"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                            >
                                {provinceName.replace(" Province", "")}
                            </text>
                        </Marker>
                    );
                })
            }
          </Geographies>

          {/* Render Major City Markers */}
          {majorCities.map((city) => {
            const cityInfoFromState = cityDetails[city.id] || city;
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo?.feature.type === 'City';
            let labelFontSize = 6;
            let circleRadius = 3;

            if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) {
                labelFontSize = city.name === "Kathmandu" ? 7 : 6.5;
                circleRadius = city.name === "Kathmandu" ? 3.5 : 3.2;
            }
            if (isSelected) {
                circleRadius *= 1.2;
            }

            return (
              <Marker key={city.id} coordinates={city.coordinates} onClick={(event) => handleFeatureClick(cityInfoFromState, event as any)}>
                 <g
                  className={`cursor-pointer transition-all duration-150 ease-out
                  ${isSelected ? 'fill-accent stroke-accent-foreground'
                               : 'fill-primary stroke-primary-foreground hover:fill-accent hover:stroke-accent-foreground'}`}
                >
                  <circle r={circleRadius} />
                </g>
                <text
                  textAnchor="middle"
                  y={- (circleRadius + 4) }
                  fontSize={labelFontSize}
                  className={`select-none pointer-events-none transition-opacity duration-150
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/80 dark:fill-foreground/60 hover:opacity-100'}`}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                >
                  {city.name}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

    {/* Info Box Card */}
    {selectedFeatureInfo && (
        <Card
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[60] transition-all duration-200 ease-out" // Increased z-index
            style={{
                left: `${selectedFeatureInfo.pageX + 15}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 300 : 270) // Adjust width threshold
                                ? 'translateX(calc(-100% - 30px))'
                                : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent map click from closing it
        >
            <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-base font-bold leading-tight flex items-center text-primary">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                    {selectedFeatureInfo.feature.type && <p className="text-xs text-muted-foreground pt-0.5 pl-6">{selectedFeatureInfo.feature.type}</p>}
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
