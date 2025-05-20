
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
} from 'react-simple-maps';
import { cn } from "@/lib/utils";
import type { Topology } from '@types/topojson-spec';


// This is the OBJECT KEY within your TopoJSON file's "objects" property that contains the geometries.
// It must match the name of the layer in your nepal-provinces-topo.json file.
const TOPOJSON_OBJECT_KEY = "nepal"; // CORRECTED TO "nepal"
const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Ensure this file exists in public/data

interface ExtendedProvinceMapData extends ProvinceFeatureProperties {
  id: string;
  type: "Province";
  population?: number;
  description?: string;
  link?: string;
  properties: ProvinceFeatureProperties;
}

type SelectedFeatureInfo = {
  feature: ExtendedProvinceMapData | ExtendedCityMapData;
  pageX: number;
  pageY: number;
} | null;


const ProvinceGeo = ({
  geo,
  provinceDetails,
  selectedFeatureInfo,
  onClick,
}: {
  geo: any;
  provinceDetails: Record<string, ExtendedProvinceMapData>;
  selectedFeatureInfo: SelectedFeatureInfo;
  onClick: (event: React.MouseEvent<SVGPathElement>, feature: ExtendedProvinceMapData) => void;
}) => {
  const properties = geo.properties as ProvinceFeatureProperties;
  // Prioritize more specific district/province names if available in properties
  let displayName = properties?.DIST_EN || properties?.ADM1_EN || properties?.NAME_1 || properties?.name || `Region ${geo.rsmKey.slice(-4)}`;
  const geoId = geo.rsmKey;

  const details = provinceDetails[geoId] || (provinceDetails[displayName.toLowerCase().replace(/\s+/g, '_')] || {});

  const featureData: ExtendedProvinceMapData = {
    id: geoId,
    name: displayName,
    type: "Province",
    population: details.population,
    description: details.description,
    link: details.link || `/districts?name=${encodeURIComponent(displayName)}`,
    properties: properties, // Keep original properties
  };

  const isSelected = selectedFeatureInfo?.feature.type === "Province" && selectedFeatureInfo?.feature.id === geoId;

  return (
    <Geography
      key={geo.rsmKey}
      geography={geo}
      onClick={(event) => onClick(event, featureData)}
      className={cn(
        "outline-none transition-all duration-150 ease-in-out cursor-pointer",
        isSelected
          ? "fill-accent/70 dark:fill-accent/60 stroke-accent-foreground/70 dark:stroke-white/70 stroke-[1.2px]"
          : "fill-card dark:fill-gray-700 hover:fill-accent/40 dark:hover:fill-accent/30 stroke-border dark:stroke-gray-500 stroke-[0.5px]"
      )}
    />
  );
};

export function HomepageMap() {
  const [selectedFeatureInfo, setSelectedFeatureInfo] = React.useState<SelectedFeatureInfo>(null);
  const [mapData, setMapData] = React.useState<Topology | null>(null);
  const [provinceDetails, setProvinceDetails] = React.useState<Record<string, ExtendedProvinceMapData>>({});
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
        // 1. Fetch and Parse TopoJSON for province boundaries
        const geoRes = await fetch(NEPAL_GEO_URL);
        console.log("HomepageMap: GeoJSON fetch response status:", geoRes.status);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const rawMapData: any = await geoRes.json();
        console.log("HomepageMap: Raw map data fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");


        if (typeof rawMapData !== 'object' || rawMapData === null || typeof rawMapData.objects !== 'object' || rawMapData.objects === null) {
          throw new Error(`Invalid TopoJSON structure: 'objects' property is missing or not an object in ${NEPAL_GEO_URL}.`);
        }
        if (!rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
           throw new Error(`Invalid TopoJSON structure: Layer key "${TOPOJSON_OBJECT_KEY}" not found in 'objects' property of ${NEPAL_GEO_URL}. Available keys: ${Object.keys(rawMapData.objects).join(', ')}`);
        }
         if (rawMapData.objects[TOPOJSON_OBJECT_KEY].type !== "GeometryCollection" || !Array.isArray(rawMapData.objects[TOPOJSON_OBJECT_KEY].geometries)) {
            throw new Error(`Invalid TopoJSON structure: Layer "${TOPOJSON_OBJECT_KEY}" is not a GeometryCollection or 'geometries' array is missing.`);
        }

        setMapData(rawMapData as Topology);

        // 2. Firestore Integration: Fetch province details (population, description, etc.)
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, ExtendedProvinceMapData> = {};
        provincesSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<ExtendedProvinceMapData, 'id' | 'type' | 'properties'>;
          const id = doc.id.toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '');
          provData[id] = {
            id: doc.id, // Use original doc.id for linking if needed
            name: data.name || doc.id, // Fallback to doc.id if name is missing
            type: "Province",
            population: data.population,
            description: data.description,
            link: data.link,
            properties: data.properties || { name: data.name || doc.id } as any,
          };
        });
        setProvinceDetails(provData);
        console.log("HomepageMap: Province details fetched from Firestore:", provData);

        // 3. Firestore Integration: Fetch city details
        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityData: Record<string, ExtendedCityMapData> = {};
        citiesSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<ExtendedCityMapData, 'id'>;
          const id = doc.id.toLowerCase().replace(/\s+/g, '_');
          cityData[id] = {
            id: doc.id, // Use original doc.id for linking
            name: data.name || doc.id,
            type: "City",
            coordinates: data.coordinates || [0,0],
            population: data.population,
            description: data.description,
            link: data.link,
            highlight: data.highlight,
            iconUrl: data.iconUrl,
          };
        });
        setCityDetails(cityData);
        console.log("HomepageMap: City details fetched from Firestore:", cityData);

      } catch (error) {
        console.error("HomepageMap: Error during data fetching", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching map data.";
        setFetchError(errorMessage);
        setMapData(null); // Ensure mapData is null on error
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: Data fetching finished. isLoading:", false);
      }
    };

    fetchData();
  }, []);

  const handleFeatureClick = (event: React.MouseEvent<SVGPathElement> | React.MouseEvent<SVGGElement>, featureData: ExtendedProvinceMapData | ExtendedCityMapData) => {
    event.stopPropagation();
    const nativeEvent = event.nativeEvent as MouseEvent;
    console.log(`${featureData.type} Clicked:`, featureData.name, "Event pageX:", nativeEvent.pageX, "pageY:", nativeEvent.pageY);
    setSelectedFeatureInfo({
      feature: featureData,
      pageX: nativeEvent.pageX,
      pageY: nativeEvent.pageY,
    });
  };

  const closeInfoBox = React.useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);

  React.useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  const majorCities: ExtendedCityMapData[] = React.useMemo(() => [
    cityDetails["kathmandu"] || { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], type: "City", description: "Capital city", link: "/districts?name=Kathmandu", highlight: true },
    cityDetails["pokhara"] || { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], type: "City", description: "City of lakes", link: "/districts?name=Kaski", highlight: true },
    cityDetails["lumbini"] || { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], type: "City", description: "Birthplace of Buddha", link: "/districts?name=Rupandehi", highlight: true },
  ], [cityDetails]);


  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Loading Interactive Map of Nepal...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="aspect-[16/9] w-full bg-destructive/10 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-destructive dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">{fetchError}. Please ensure '{NEPAL_GEO_URL}' exists in /public/data/ and is a valid TopoJSON file with a layer named '{TOPOJSON_OBJECT_KEY}'. Also check Firestore connectivity and data.</p>
      </div>
    );
  }

  if (!mapData || !mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY] || !mapData.objects[TOPOJSON_OBJECT_KEY].geometries) {
    console.error("HomepageMap: Rendering fallback UI because mapData or expected TopoJSON structure is invalid. mapData:", mapData, "TOPOJSON_OBJECT_KEY:", TOPOJSON_OBJECT_KEY);
    return (
        <div className="aspect-[16/9] w-full bg-muted/20 rounded-lg flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
            <InfoIcon className="h-10 w-10 mb-2 text-destructive" />
            <p className="font-semibold mb-1 text-lg text-destructive">Map Data Unavailable</p>
            <p className="text-xs">Could not load map geometries. Ensure '{NEPAL_GEO_URL}' is valid and contains a layer named '{TOPOJSON_OBJECT_KEY}' with geometries.</p>
        </div>
    );
}

  return (
    <>
      {/* Debug Text - remove after confirming info box visibility */}
      <div
        className="fixed top-2 left-2 bg-yellow-300 text-black p-2 z-[100000] text-xs"
        style={{ display: selectedFeatureInfo ? 'block' : 'none' }}
      >
        Debug Info Box: {selectedFeatureInfo?.feature?.name} at X:{selectedFeatureInfo?.pageX} Y:{selectedFeatureInfo?.pageY}
      </div>

      {selectedFeatureInfo && (
        <Card
          style={{
            position: 'fixed',
            left: `${selectedFeatureInfo.pageX + 15}px`,
            top: `${selectedFeatureInfo.pageY + 15}px`,
            transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.clientWidth - 270 // 256px card width + 15px offset
                ? 'translateX(calc(-100% - 30px))' // Shift left if too close to right edge
                : 'translateX(0)',
          }}
          className={cn(
            "p-0 w-64 shadow-xl border-border z-[60] rounded-md bg-card text-card-foreground",
            "transition-all duration-200 ease-out opacity-100"
          )}
          onClick={(e) => e.stopPropagation()} // Prevent map click from closing it
        >
          <CardHeader className="flex flex-row items-center justify-between p-3 border-b bg-muted/50">
            <CardTitle className="text-sm font-semibold text-primary flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary/80" />
              {selectedFeatureInfo.feature.name}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={closeInfoBox} aria-label="Close info box">
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
        onClick={closeInfoBox} // Close info box when clicking on the map background
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 4500,
            center: [84.1240, 28.3949]
          }}
          style={{ width: "100%", height: "100%" }}
          aria-label="Interactive map of Nepal showing provinces and key cities"
        >
          <ZoomableGroup center={[84.1240, 28.3949]} zoom={1} minZoom={0.7} maxZoom={10}>
            <Geographies 
              geography={mapData} 
              parseGeographies={data => {
                // This function extracts the 'geometries' array from the correct layer in TopoJSON
                if (!data || typeof data.objects !== 'object' || data.objects === null) {
                  console.error("parseGeographies: Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                  return [];
                }
                const key = TOPOJSON_OBJECT_KEY; // Use the hardcoded key
                if (!key || !data.objects[key]) {
                  console.error(`parseGeographies: Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                  return [];
                }
                const layer = data.objects[key];
                if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                    return layer.geometries;
                }
                console.error(`parseGeographies: Layer for key "${key}" is not a GeometryCollection or 'geometries' array is missing. Layer type:`, layer ? layer.type : 'undefined');
                return [];
              }}
            >
              {({ geographies }) =>
                geographies.map(geo => (
                   <ProvinceGeo
                       key={geo.rsmKey}
                       geo={geo}
                       provinceDetails={provinceDetails}
                       selectedFeatureInfo={selectedFeatureInfo}
                       onClick={handleFeatureClick}
                   />
                ))
              }
            </Geographies>
             {/* Render Province Labels */}
            <Geographies 
                geography={mapData}
                parseGeographies={data => {
                    if (!data || typeof data.objects !== 'object' || data.objects === null) return [];
                    const key = TOPOJSON_OBJECT_KEY;
                    if (!key || !data.objects[key] || !Array.isArray(data.objects[key].geometries)) return [];
                    return data.objects[key].geometries;
                }}
            >
              {({ geographies }) =>
                geographies.map(geo => {
                  const properties = geo.properties as ProvinceFeatureProperties;
                  const centroid = (geo as any).centroid as [number, number] | undefined; // react-simple-maps adds this
                  let displayName = properties?.DIST_EN || properties?.ADM1_EN || properties?.NAME_1 || properties?.name || '';

                  if (!centroid || !displayName) return null;
                  
                  // Simple filter to declutter, you might want a more sophisticated labeling strategy
                  const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi"]; // Example
                  if (!showLabelFor.some(pName => displayName.includes(pName)) && displayName !== "Kathmandu") {
                      // return null; // Uncomment to filter labels
                  }

                  return (
                    <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        y={-2} // Adjust y offset as needed
                        className="fill-foreground dark:fill-gray-200 pointer-events-none select-none"
                        style={{ fontSize: "6px", fontWeight: 500, paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinecap: "butt", strokeLinejoin: "miter" }}
                      >
                        {displayName}
                      </text>
                    </Marker>
                  );
                })
              }
            </Geographies>
            {majorCities.map(city => {
               const isSelected = selectedFeatureInfo?.feature.type === "City" && selectedFeatureInfo?.feature.id === city.id;
               return (
                <Marker
                  key={city.id}
                  coordinates={city.coordinates}
                  onClick={(event) => handleFeatureClick(event, city)}
                >
                  <circle
                    r={isSelected ? 6 : 4}
                    className={cn(
                      "transition-all duration-150 ease-in-out cursor-pointer",
                      isSelected
                        ? "fill-accent stroke-accent-foreground/70"
                        : "fill-primary stroke-primary-foreground/70 hover:fill-accent/70"
                    )}
                    strokeWidth={0.3}
                  />
                  <text
                    textAnchor="middle"
                    y={city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini" ? -10 : -8}
                    className={cn(
                      "fill-foreground pointer-events-none select-none font-semibold",
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
          Map data &copy; <a href="https://gadm.org/" target="_blank" rel="noopener noreferrer" className="hover:underline text-accent">GADM</a> (simplified). City data indicative.
        </div>
      </div>
    </>
  );
}
