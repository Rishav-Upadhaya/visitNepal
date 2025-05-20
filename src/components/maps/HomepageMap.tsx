
"use client";

import type { ExtendedFeature, ExtendedCityMapData, ProvinceFeatureProperties } from '@/types';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { InfoIcon, ExternalLink, XIcon, MapPin } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
  type GeographyObject,
} from 'react-simple-maps';
import { cn } from "@/lib/utils";

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // Adjusted based on your TopoJSON structure

type SelectedFeatureInfo = {
  feature: {
    id: string;
    name: string;
    type: "Province" | "City";
    population?: number;
    description?: string;
    link?: string;
    properties?: any; // Original properties from GeoJSON/TopoJSON feature
  };
  pageX: number;
  pageY: number;
} | null;

export function HomepageMap() {
  const [selectedFeatureInfo, setSelectedFeatureInfo] = React.useState<SelectedFeatureInfo>(null);
  const [mapData, setMapData] = React.useState<any | null>(null); // Will store the entire TopoJSON object
  const [provinceDetails, setProvinceDetails] = React.useState<Record<string, ProvinceFeatureProperties>>({});
  const [cityDetails, setCityDetails] = React.useState<Record<string, ExtendedCityMapData>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      console.log("HomepageMap: Starting data fetch...");

      try {
        // 1. Fetch TopoJSON for province boundaries
        const geoRes = await fetch(NEPAL_GEO_URL);
        console.log("HomepageMap: TopoJSON fetch response status:", geoRes.status);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const rawMapData: any = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON fetched. Sample:", JSON.stringify(rawMapData).substring(0, 300));

        if (rawMapData && typeof rawMapData.objects === 'object' && rawMapData.objects !== null && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          setMapData(rawMapData);
          console.log(`HomepageMap: TopoJSON loaded successfully, using object key "${TOPOJSON_OBJECT_KEY}".`);
        } else {
          const errorMsg = `Invalid TopoJSON data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }

        // 2. Firestore Integration: Fetch province details
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, ProvinceFeatureProperties> = {};
        provincesSnapshot.forEach((doc) => {
          const data = doc.data() as ProvinceFeatureProperties;
          const id = data.name?.toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '') || doc.id;
          provData[id] = { ...data, name: data.name || doc.id };
        });
        setProvinceDetails(provData);
        console.log("HomepageMap: Province details fetched from Firestore:", provData);

        // 3. Firestore Integration: Fetch city details
        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityData: Record<string, ExtendedCityMapData> = {};
        citiesSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<ExtendedCityMapData, 'id'>;
          const id = data.name?.toLowerCase().replace(/\s+/g, '_') || doc.id;
          cityData[id] = {
            id: doc.id,
            name: data.name || doc.id,
            type: "City",
            coordinates: data.coordinates || [0,0],
            population: data.population,
            description: data.description,
            link: data.link,
            highlight: data.highlight,
          };
        });
        setCityDetails(cityData);
        console.log("HomepageMap: City details fetched from Firestore:", cityData);

      } catch (error) {
        console.error("HomepageMap: Error during data fetching", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching map data.";
        if (errorMessage.includes("offline") || errorMessage.includes("Failed to get document")) {
            setFetchError(`Data Caching Error: Could not connect to update map details. Displaying cached map. (Details: ${errorMessage})`);
            // Allow map to render with potentially stale/no Firestore data if TopoJSON loaded
            if (!mapData && !isLoading) setIsLoading(true); // If TopoJSON also failed, show loading/error
        } else {
            setFetchError(errorMessage);
        }
        if (!mapData) setMapData(null); // Ensure mapData is null if TopoJSON part failed
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: Data fetching finished. isLoading:", false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  React.useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  const majorCities: ExtendedCityMapData[] = React.useMemo(() => {
    const citySource = [
        cityDetails["kathmandu"] || { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], type: "City", description: "Capital city of Nepal.", link: "/districts?name=Kathmandu", highlight: true, population: 1442271 },
        cityDetails["pokhara"] || { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], type: "City", description: "City of lakes and gateway to Annapurna.", link: "/districts?name=Kaski", highlight: true, population: 400000 },
        cityDetails["lumbini"] || { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], type: "City", description: "Birthplace of Lord Buddha.", link: "/districts?name=Rupandehi", highlight: true, population: 70000 },
    ];
    // Filter out any cities that might be undefined if not found in cityDetails
    return citySource.filter(city => city.name && city.coordinates) as ExtendedCityMapData[];
}, [cityDetails]);


  if (fetchError && !mapData) { // Only show full error if mapData (TopoJSON) itself failed
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">
          {fetchError.includes("404")
            ? `Could not load map data from ${NEPAL_GEO_URL}. Please ensure the file exists in /public/data/ and is correctly named.`
            : fetchError.includes("offline")
            ? `Could not connect to fetch map details. Please check your internet connection and Firebase setup. (Error: ${fetchError})`
            : `An error occurred: ${fetchError}`
          }
        </p>
      </div>
    );
  }
  
  if (isLoading || !mapData) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/30 rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Loading Interactive Map of Nepal...</p>
      </div>
    );
  }

  // Check if the specific object key exists in the loaded TopoJSON
  if (!mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY]) {
    console.error(`HomepageMap: TopoJSON loaded, but the expected object key "${TOPOJSON_OBJECT_KEY}" was not found. Available keys:`, Object.keys(mapData.objects || {}));
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
        <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Configuration Error</p>
        <p className="text-xs">The TopoJSON layer named "{TOPOJSON_OBJECT_KEY}" could not be found. Please check the file structure and TOPOJSON_OBJECT_KEY constant.</p>
      </div>
    );
  }


  return (
    <>
      {/* Top-level Debug State Indicator */}
      {/* <div className="fixed top-2 left-2 bg-yellow-300 text-black p-1 z-[100000] text-xs">
        Debug Info: Selected: {selectedFeatureInfo?.feature?.name || 'None'} at X:{selectedFeatureInfo?.pageX} Y:{selectedFeatureInfo?.pageY}
      </div> */}

      {selectedFeatureInfo && (
        <Card
          style={{
            position: 'fixed',
            left: `${selectedFeatureInfo.pageX + 15}px`,
            top: `${selectedFeatureInfo.pageY + 15}px`,
            transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.clientWidth - 270 
                ? 'translateX(calc(-100% - 30px))' 
                : 'translateX(0)',
          }}
          className={cn(
            "p-0 w-64 shadow-xl border-border z-[60] rounded-md bg-card text-card-foreground",
            "transition-all duration-200 ease-out opacity-100" // For smooth appearance
          )}
          onClick={(e) => e.stopPropagation()} // Prevent map click from closing it
        >
          <CardHeader className="flex flex-row items-center justify-between p-3 border-b bg-muted/50">
            <CardTitle className="text-sm font-semibold text-primary flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary/80" />
              {selectedFeatureInfo.feature.name}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedFeatureInfo(null)} aria-label="Close info box">
              <XIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
          </CardHeader>
          <CardContent className="p-3 text-xs text-muted-foreground">
            {selectedFeatureInfo.feature.description ? (
              <p className="line-clamp-3">{selectedFeatureInfo.feature.description}</p>
            ) : (
              <p>Explore more about {selectedFeatureInfo.feature.name}.</p>
            )}
            {selectedFeatureInfo.feature.population && (
              <p className="mt-1.5">Population: {selectedFeatureInfo.feature.population.toLocaleString()}</p>
            )}
          </CardContent>
          {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 border-t">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full text-xs h-auto py-1.5 border-accent text-accent hover:bg-accent/10 hover:text-accent-foreground"
              >
                <Link href={selectedFeatureInfo.feature.link} target={selectedFeatureInfo.feature.link.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer">
                  Learn More <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      <div
        ref={mapContainerRef}
        className="relative aspect-[16/9] w-full bg-lime-100 dark:bg-green-900/30 rounded-lg shadow-lg overflow-hidden border border-border cursor-default"
        onClick={() => setSelectedFeatureInfo(null)} // Close info box when clicking on the map background
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 4500, // Adjust scale to fit Nepal well
            center: [84.1240, 28.3949] // Center of Nepal
          }}
          style={{ width: "100%", height: "100%" }}
          aria-label="Interactive map of Nepal showing provinces and key cities"
        >
          <ZoomableGroup center={[84.1240, 28.3949]} zoom={1} minZoom={0.7} maxZoom={10}>
            <Geographies 
              geography={mapData} 
              parseGeographies={data => {
                console.log("parseGeographies called. TOPOJSON_OBJECT_KEY:", TOPOJSON_OBJECT_KEY);
                if (!data || typeof data.objects !== 'object' || data.objects === null) {
                  console.error("parseGeographies: Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                  return [];
                }
                const key = TOPOJSON_OBJECT_KEY;
                if (!key || !data.objects[key]) {
                  console.error(`parseGeographies: Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                  return [];
                }
                const layer = data.objects[key];
                if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                  return layer.geometries;
                }
                // If it's a single geometry type, react-simple-maps might handle it if wrapped in an array
                if (layer && ["Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(layer.type) && layer.coordinates) {
                   console.warn(`parseGeographies: Layer for key "${key}" is a single geometry, not a GeometryCollection. Wrapping it.`)
                   return [layer]; // Attempt to wrap single geometry
                }
                console.error(`parseGeographies: Layer for key "${key}" is not a GeometryCollection and does not have a 'geometries' array, nor is it a recognized single geometry. Layer type:`, layer ? layer.type : 'undefined');
                return [];
              }}
            >
              {({ geographies }) =>
                geographies.map((geo: any) => { // Type as any for flexibility with TopoJSON properties
                  const currentProperties = geo.properties as ProvinceFeatureProperties;
                  const geoId = geo.id || currentProperties?.DIST_EN || currentProperties?.ADM1_EN || currentProperties?.name || `geo-${geo.rsmKey?.slice(-4)}`; // Ensure a unique ID
                  const provinceName = currentProperties?.name || currentProperties?.ADM1_EN || currentProperties?.DIST_EN || `Region ${geo.rsmKey?.slice(-4) || 'Unknown'}`;
                  
                  const firestoreKey = provinceName.toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '');
                  const details = provinceDetails[firestoreKey] || {};
                  const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo?.feature.type === "Province";

                  const featureDataForClick = {
                    id: geoId,
                    name: details.name || provinceName,
                    type: "Province" as "Province" | "City",
                    population: details.population,
                    description: details.description,
                    link: details.link || `/districts?name=${encodeURIComponent(provinceName)}`,
                    properties: currentProperties,
                  };

                  return (
                    <Geography
                      key={geo.rsmKey || geoId}
                      geography={geo as GeographyObject}
                      onClick={(event: React.MouseEvent<SVGPathElement>) => {
                        event.stopPropagation();
                        setSelectedFeatureInfo({
                          feature: featureDataForClick,
                          pageX: event.pageX,
                          pageY: event.pageY,
                        });
                        console.log("Geography Clicked:", provinceName, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureDataForClick);
                      }}
                      className={cn(
                        "outline-none transition-all duration-150 ease-in-out cursor-pointer",
                        isSelected
                          ? "fill-accent/70 dark:fill-accent/60 stroke-accent-foreground/70 dark:stroke-white/70 stroke-[1.2px]"
                          : "fill-card dark:fill-gray-700 hover:fill-accent/40 dark:hover:fill-accent/30 stroke-border dark:stroke-gray-500 stroke-[0.5px]"
                      )}
                    />
                  );
                })
              }
            </Geographies>
            <Geographies 
                geography={mapData}
                parseGeographies={data => {
                    if (!data || typeof data.objects !== 'object' || data.objects === null) return [];
                    const key = TOPOJSON_OBJECT_KEY;
                    if (!key || !data.objects[key]) return [];
                    const layer = data.objects[key];
                    if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                        return layer.geometries;
                    }
                    if (layer && ["Polygon", "MultiPolygon"].includes(layer.type) && layer.coordinates) return [layer];
                    return [];
                }}
            >
              {({ geographies }) =>
                geographies.map((geo: any) => {
                  const properties = geo.properties as ProvinceFeatureProperties;
                  const centroid = (geo as any).centroid as [number, number] | undefined; // react-simple-maps adds this
                  let displayName = properties?.name || properties?.ADM1_EN || properties?.DIST_EN || '';

                  if (!centroid || !displayName) return null;
                  
                  const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi", "Sudurpashchim", "Karnali", "Madhesh"]; 
                  const isMajorProvince = showLabelFor.some(pName => displayName.includes(pName));
                 
                  if (!isMajorProvince) return null;

                  return (
                    <Marker key={`label-${geo.rsmKey || displayName}`} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        y={-2} 
                        className="fill-foreground dark:fill-gray-200 pointer-events-none select-none"
                        style={{ 
                            fontSize: "6px", 
                            fontWeight: 500, 
                            paintOrder: "stroke", 
                            stroke: "hsl(var(--background))", 
                            strokeWidth: "0.5px", 
                            strokeLinecap: "butt", 
                            strokeLinejoin: "miter" 
                        }}
                      >
                        {displayName}
                      </text>
                    </Marker>
                  );
                })
              }
            </Geographies>
            {majorCities.map(city => {
               const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo?.feature.type === "City";
               const featureDataForClick = { ...city, type: "City" as "City" }; // Ensure type is correctly set for city

               return (
                <Marker
                  key={city.id}
                  coordinates={city.coordinates}
                  onClick={(event: React.MouseEvent<SVGGElement>) => {
                    event.stopPropagation();
                    setSelectedFeatureInfo({
                      feature: featureDataForClick,
                      pageX: event.pageX,
                      pageY: event.pageY,
                    });
                     console.log("City marker clicked:", city.name, "Event pageX:", event.pageX, "pageY:", event.pageY);
                  }}
                >
                  <circle
                    r={isSelected ? 6 : (city.highlight ? 5 : 4)}
                    className={cn(
                      "transition-all duration-150 ease-in-out cursor-pointer",
                      isSelected 
                        ? "fill-accent dark:fill-accent stroke-accent-foreground" 
                        : (city.highlight ? "fill-primary dark:fill-primary hover:fill-accent/70 dark:hover:fill-accent/60" : "fill-primary/70 dark:fill-primary/60 hover:fill-accent/50 dark:hover:fill-accent/40"),
                      "stroke-background dark:stroke-gray-800"
                    )}
                    strokeWidth={0.5}
                  />
                  <text
                    textAnchor="middle"
                    y={city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini" ? -10 : -8} // Adjusted y offset
                    className={cn(
                      "fill-foreground dark:fill-gray-200 pointer-events-none select-none font-semibold",
                       (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") ? "text-[7px] md:text-[9px]" : "text-[5px] md:text-[6px]"
                    )}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinecap: "butt", strokeLinejoin: "miter" }}
                  >
                    {city.name}
                  </text>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
        <div className="absolute bottom-2 right-2 bg-background/80 p-1.5 rounded shadow text-[0.6rem] text-muted-foreground">
          Map data &copy; Nepal. Boundaries indicative. Click to explore.
        </div>
      </div>
    </>
  );
}

    