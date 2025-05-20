
"use client";

import type { LegacyRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types'; // Corrected import
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase'; // Ensure this path is correct
import { collection, getDocs, doc, getDoc, type DocumentData } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, InfoIcon, XIcon, LocateFixed } from 'lucide-react';
import { feature } from 'topojson-client';
import type { Topology, Objects } from 'topojson-specification';

const NEPAL_TOPO_URL = "/data/nepal-provinces-topo.json"; // Using TopoJSON for province boundaries
const TOPOJSON_OBJECT_KEY = "nepal"; // The key of the object layer in your TopoJSON file that contains province/district geometries

interface HomepageMapProps {}

// Define a more specific type for the selected feature's information
interface SelectedFeatureDisplayInfo {
  id: string;
  name: string;
  type: 'Province' | 'City';
  population?: number | string;
  description?: string;
  link?: string;
  pageX: number;
  pageY: number;
}


export function HomepageMap({}: HomepageMapProps) {
  const [mapData, setMapData] = useState<any | null>(null); // Holds the full TopoJSON object
  const [provinceDetails, setProvinceDetails] = useState<Record<string, ProvinceMapData>>({});
  const [cityDetails, setCityDetails] = useState<Record<string, CityMapData>>({});
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const majorCities: CityMapData[] = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', link: '/districts?name=Kathmandu', population: 1442271, description: "Capital city, rich in culture." },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', link: '/districts?name=Kaski', population: 400000, description: "City of lakes and mountains." },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', link: '/districts?name=Rupandehi', population: 70000, description: "Birthplace of Lord Buddha." },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        // Fetch TopoJSON for province boundaries
        const geoRes = await fetch(NEPAL_TOPO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_TOPO_URL}: ${geoRes.status}. Response: ${errorText}`);
        }
        const rawMapData: any = await geoRes.json();
        console.log("HomepageMap: TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");

        if (!rawMapData.objects || !rawMapData.objects[TOPOJSON_OBJECT_KEY] || typeof rawMapData.objects[TOPOJSON_OBJECT_KEY].geometries === 'undefined') {
          const errorMsg = `Invalid map data structure in ${NEPAL_TOPO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}.geometries' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
          setIsLoading(false);
          return;
        }
        setMapData(rawMapData);

        // Fetch province details from Firestore
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const details: Record<string, ProvinceMapData> = {};
        provincesSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as ProvinceMapData;
          details[docSnap.id.toLowerCase()] = { ...data, id: docSnap.id };
        });
        setProvinceDetails(details);
        console.log("HomepageMap: Province details fetched:", details);

        // Fetch major city details (can be combined with majorCities array if preferred)
        const cityDetailsData: Record<string, CityMapData> = {};
        for (const city of majorCities) {
            const cityDocRef = doc(db, "nepal_major_cities_data", city.id);
            const cityDocSnap = await getDoc(cityDocRef);
            if (cityDocSnap.exists()) {
                cityDetailsData[city.id] = { ...cityDocSnap.data(), id: city.id } as CityMapData;
            } else { // Fallback to static data if Firestore has no entry
                cityDetailsData[city.id] = city;
            }
        }
        setCityDetails(cityDetailsData);
        console.log("HomepageMap: City details fetched/merged:", cityDetailsData);


      } catch (err) {
        console.error("HomepageMap: Error fetching data:", err);
        setFetchError(err instanceof Error ? err.message : "An unknown error occurred while fetching map data.");
        setMapData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  const handleGeographyClick = (geo: any, event: React.MouseEvent<SVGPathElement>) => {
    event.stopPropagation();
    const properties = geo.properties as ProvinceMapData; // Adjust type if properties differ
    const provinceId = (properties?.id || properties?.ID || properties?.OBJECTID || geo.id || geo.rsmKey)?.toString().toLowerCase();
    const details = provinceId ? provinceDetails[provinceId] : null;
    const provinceName = properties?.name || properties?.NAME_1 || properties?.ADM1_EN || "Unknown Province";

    const featureData: SelectedFeatureDisplayInfo = {
      id: provinceId || geo.rsmKey || `province-${Math.random()}`,
      name: provinceName,
      type: 'Province',
      population: details?.population || 'N/A',
      description: details?.description || `Explore the diverse region of ${provinceName}.`,
      link: details?.link || `/districts?name=${encodeURIComponent(provinceName)}`,
      pageX: event.pageX,
      pageY: event.pageY,
    };
    console.log("Geography Clicked:", provinceName, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureData);
    setSelectedFeatureInfo(featureData);
  };

  const handleCityClick = (cityId: string, event: React.MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    const city = cityDetails[cityId] || majorCities.find(c => c.id === cityId);
    if (city) {
      const featureData: SelectedFeatureDisplayInfo = {
        id: city.id,
        name: city.name,
        type: 'City',
        population: city.population || 'N/A',
        description: city.description || `Discover ${city.name}, a major city in Nepal.`,
        link: city.link || `/districts?name=${encodeURIComponent(city.name)}`, // Adjust link as needed
        pageX: event.pageX,
        pageY: event.pageY,
      };
      console.log("City marker clicked:", city.name, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureData);
      setSelectedFeatureInfo(featureData);
    }
  };
  
  const closeInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);


  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/30 dark:bg-muted/50 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map...</p>
      </div>
    );
  }

  if (fetchError || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{fetchError?.includes("404") ? `Could not load map data. Please ensure ${NEPAL_TOPO_URL} exists in the public/data directory.` : fetchError || "Unknown error loading map data."}</p>
        <p className="text-xs mt-2">If the file exists, please check its TopoJSON structure and console for more details.</p>
      </div>
    );
  }

  // Fallback error for TopoJSON structure if critical parts are missing after successful fetch
  if (!mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY] || !mapData.objects[TOPOJSON_OBJECT_KEY].geometries) {
      console.error("HomepageMap: Critical error - Invalid TopoJSON structure or missing/invalid layer. Key used:", TOPOJSON_OBJECT_KEY, "Available objects:", mapData.objects);
      return (
          <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
              <InfoIcon className="h-10 w-10 mb-2" />
              <p className="font-semibold text-lg mb-1">Map Structure Error</p>
              <p className="text-sm">The TopoJSON file at {NEPAL_TOPO_URL} is missing the expected layer named &quot;{TOPOJSON_OBJECT_KEY}&quot; or this layer has an invalid structure (e.g., missing 'geometries').</p>
              <p className="text-xs mt-2">Please verify the TopoJSON file content and structure.</p>
          </div>
      );
  }


  return (
    <div ref={mapContainerRef} className="relative w-full aspect-[16/9] bg-green-50 dark:bg-green-900/20 rounded-xl overflow-hidden border border-border" onClick={closeInfoBox}>
        {/* Top-left debug indicator (TEMPORARY - REMOVE AFTER INFOBOX WORKS) */}
        {selectedFeatureInfo && (
            <div className="fixed top-2 left-2 bg-yellow-300 text-black p-1 z-[100000] text-xs">
                DEBUG: Info for {selectedFeatureInfo.name} | X: {selectedFeatureInfo.pageX}, Y: {selectedFeatureInfo.pageY}
            </div>
        )}

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 2800, // Adjust scale to fit Nepal
          center: [84.1240, 28.3949] // Longitude, Latitude for center of Nepal
        }}
        className="w-full h-full"
        
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
                const key = TOPOJSON_OBJECT_KEY; 
                if (!key || !data.objects[key]) {
                  console.error(`parseGeographies: Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                  return [];
                }
                const layer = data.objects[key];
                if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                    return layer.geometries;
                }
                // Fallback for single geometry layers (less common for administrative boundaries)
                if (layer && ["Polygon", "MultiPolygon"].includes(layer.type)) {
                     console.warn(`parseGeographies: Layer for key "${key}" is a single geometry. Wrapping it in an array.`);
                     return [layer];
                }
                console.error(`parseGeographies: Layer "${key}" is not a GeometryCollection or a recognized single geometry. Layer content:`, layer);
                return [];
            }}
          >
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ProvinceMapData; // Or your specific feature properties type
                const provinceId = (properties?.id || properties?.ID || properties?.OBJECTID || geo.id || geo.rsmKey)?.toString().toLowerCase();
                const isSelected = selectedFeatureInfo?.type === 'Province' && selectedFeatureInfo.id === (provinceId || geo.rsmKey);
                const isHovered = false; // Hover state can be managed separately if needed later

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleGeographyClick(geo, event)}
                    className={
                      `cursor-pointer transition-colors duration-150 ease-out 
                       ${isSelected ? 'fill-accent/70 dark:fill-accent/50 stroke-accent-foreground dark:stroke-accent-foreground/70 stroke-[0.75px]' 
                                  : 'fill-card dark:fill-primary/10 stroke-border dark:stroke-border/50 stroke-[0.25px] hover:fill-accent/40 dark:hover:fill-accent/30'}`
                    }
                  />
                );
              })
            }
          </Geographies>

          {/* Province Labels */}
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
                    const properties = geo.properties as ProvinceMapData;
                    const provinceName = properties?.name || properties?.NAME_1 || properties?.ADM1_EN || "Province";
                    const centroid = (geo as any).centroid as [number, number] | undefined;
                    if (!centroid) return null;

                    return (
                        <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={0}
                                fontSize={5}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground/70 dark:fill-foreground/50 font-medium pointer-events-none select-none"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--card))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                            >
                                {provinceName}
                            </text>
                        </Marker>
                    );
                })
            }
          </Geographies>

          {/* Major City Markers */}
          {majorCities.map((city) => {
            const cityInfo = cityDetails[city.id] || city;
            const isSelected = selectedFeatureInfo?.type === 'City' && selectedFeatureInfo.id === city.id;
            return (
              <Marker key={city.id} coordinates={city.coordinates} onClick={(event: React.MouseEvent<SVGGElement>) => handleCityClick(city.id, event)}>
                <g
                  className={`cursor-pointer transition-all duration-150 ease-out 
                  ${isSelected ? 'fill-accent stroke-accent-foreground' 
                               : 'fill-primary stroke-primary-foreground hover:fill-accent hover:stroke-accent-foreground'}`}
                >
                  <circle r={isSelected ? 4 : 3} className="opacity-70" />
                  <circle r={isSelected ? 2.5 : 1.5} />
                </g>
                <text
                  textAnchor="middle"
                  y={city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini" ? -10 : -8}
                  className={`select-none pointer-events-none transition-opacity duration-150 
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/80 dark:fill-foreground/60 hover:opacity-100'}
                    ${city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini" ? 'text-[7px] md:text-[8px]' : 'text-[5px] md:text-[6px]'}`}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--card))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                >
                  {cityInfo.name}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

    {/* Info Box Card - Styled with ShadCN */}
    {selectedFeatureInfo && (
      <Card
        className="fixed p-0 w-60 md:w-64 shadow-2xl border-border z-[1000] transition-all duration-200 ease-out bg-card text-card-foreground"
        style={{
          left: `${selectedFeatureInfo.pageX + 15}px`,
          top: `${selectedFeatureInfo.pageY + 15}px`,
          transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.offsetWidth - 280 ? 'translateX(calc(-100% - 30px))' : 'translateX(0)',
        }}
        onClick={(e) => e.stopPropagation()} // Prevent map click from closing it
      >
        <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold leading-none flex items-center">
              <MapPin className="w-4 h-4 mr-1.5 text-primary" />
              {selectedFeatureInfo.feature.name}
            </CardTitle>
            {selectedFeatureInfo.feature.type && <CardDescription className="text-xs text-muted-foreground pt-0.5">{selectedFeatureInfo.feature.type}</CardDescription>}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" onClick={closeInfoBox} aria-label="Close info box">
            <XIcon className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-3 text-sm space-y-1.5">
          {selectedFeatureInfo.feature.population && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground/80">Population:</span> {selectedFeatureInfo.feature.population.toLocaleString()}
            </p>
          )}
          {selectedFeatureInfo.feature.description && (
            <p className="text-muted-foreground line-clamp-3">
              {selectedFeatureInfo.feature.description}
            </p>
          )}
        </CardContent>
        {selectedFeatureInfo.feature.link && (
          <CardFooter className="p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground"
              onClick={() => router.push(selectedFeatureInfo.feature.link!)}
            >
              Learn More <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </CardFooter>
        )}
      </Card>
    )}
    </div>
  );
}

// Helper to extract a display name from various possible properties
function getFeatureName(properties: any): string {
    return properties?.name || properties?.NAME_1 || properties?.ADM1_EN || properties?.DIST_EN || properties?.DISTRICT || "Unknown Area";
}
function getFeatureId(geo: any, properties: any): string {
    return (properties?.id || properties?.ID || properties?.OBJECTID || geo.id || geo.rsmKey || String(Math.random())).toString();
}

