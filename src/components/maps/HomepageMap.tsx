
"use client";

import type { ExtendedCityMapData, ExtendedProvinceMapData, ProvinceFeatureProperties } from '@/types';
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

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Ensure this TopoJSON file exists and is correct

type SelectedFeatureInfo = {
  feature: ExtendedProvinceMapData | ExtendedCityMapData;
  pageX: number;
  pageY: number;
} | null;

const majorCities: ExtendedCityMapData[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], type: "City", description: "Capital city, rich in culture and ancient temples.", link: "/districts?name=Kathmandu", population: 1442271, properties: {} },
  { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], type: "City", description: "City of lakes, with stunning Himalayan views.", link: "/districts?name=Kaski", population: 400000, properties: {} },
  { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], type: "City", description: "Birthplace of Lord Buddha, a sacred pilgrimage site.", link: "/districts?name=Rupandehi", population: 100000, properties: {} },
];

export function HomepageMap() {
  const [selectedFeatureInfo, setSelectedFeatureInfo] = React.useState<SelectedFeatureInfo>(null);
  const [mapData, setMapData] = React.useState<any | null>(null);
  const provinceObjectKeyRef = React.useRef<string | null>(null);
  const [provinceDetails, setProvinceDetails] = React.useState<Record<string, Partial<ExtendedProvinceMapData>>>({});
  const [cityDetails, setCityDetails] = React.useState<Record<string, Partial<ExtendedCityMapData>>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      provinceObjectKeyRef.current = null; // Reset key ref
      console.log("HomepageMap: Starting to fetch map data from", NEPAL_GEO_URL);

      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          console.error(`HomepageMap: Failed to fetch ${NEPAL_GEO_URL}. Status: ${geoRes.status}. Response: ${errorText.substring(0,200)}...`);
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Ensure the file exists at public${NEPAL_GEO_URL}.`);
        }
        
        const rawMapData: any = await geoRes.json();
        console.log("HomepageMap: Raw map data fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");

        if (rawMapData && typeof rawMapData.objects === 'object' && rawMapData.objects !== null && Object.keys(rawMapData.objects).length > 0) {
          const keys = Object.keys(rawMapData.objects);
          console.log("HomepageMap: Raw TopoJSON objects keys:", keys);
          const firstKey = keys[0]; // Let's assume the first key is our main layer
          
          if (rawMapData.objects[firstKey] && typeof rawMapData.objects[firstKey] === 'object' && typeof rawMapData.objects[firstKey].geometries !== 'undefined') {
            console.log("HomepageMap: Using first key as province object key:", firstKey, "Layer content sample:", JSON.stringify(rawMapData.objects[firstKey], null, 2).substring(0,200)+"...");
            provinceObjectKeyRef.current = firstKey;
            setMapData(rawMapData);
          } else {
            const errorMsg = `Invalid TopoJSON: Layer "${firstKey}" in ${NEPAL_GEO_URL} is not a valid GeometryCollection or does not contain 'geometries'. Check file content. Layer content: ${JSON.stringify(rawMapData.objects[firstKey])}`;
            console.error("HomepageMap:", errorMsg);
            setFetchError(errorMsg);
            setMapData(null);
            setIsLoading(false);
            return;
          }
        } else {
          const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with a valid, non-empty 'objects' property. Received: ${JSON.stringify(rawMapData)}`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
          setIsLoading(false);
          return;
        }

        // Fetch province details from Firestore
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, Partial<ExtendedProvinceMapData>> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          const normalizedId = (data.id?.toLowerCase() || doc.id.toLowerCase()).replace(/\s+/g, '_').replace(/_province$/, '');
          provData[normalizedId] = { population: data.population, description: data.description, link: data.link };
        });
        setProvinceDetails(provData);
        console.log("HomepageMap: Province details fetched and set:", provData);

        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityDataColl: Record<string, Partial<ExtendedCityMapData>> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          cityDataColl[doc.id.toLowerCase()] = { population: data.population, description: data.description, link: data.link };
        });
        setCityDetails(cityDataColl);
        console.log("HomepageMap: City details fetched and set:", cityDataColl);

      } catch (error) {
        console.error("HomepageMap: DEBUG - Error during data fetching:", error);
        let errorMsg = error instanceof Error ? error.message : "An unknown error occurred while loading map data.";
        if (errorMsg.includes("offline") || errorMsg.includes("Failed to get document") || errorMsg.includes("firestore/unavailable") || errorMsg.includes("Firebase")) {
            errorMsg = "Map data could not be loaded. Please check your internet connection and Firebase setup. Also ensure the map file exists at public" + NEPAL_GEO_URL + ".";
        }
        setFetchError(errorMsg);
        setMapData(null);
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: Data fetching finished, isLoading set to false.");
      }
    };
    fetchData();
  }, []);

  const handleMapContainerClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Close info box if clicking on the map container itself (and not on a feature)
    if (event.target === event.currentTarget) {
        setSelectedFeatureInfo(null);
    }
  }, []);
  
  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Loading Interactive Map of Nepal...</p>
      </div>
    );
  }
  
  if (fetchError || !mapData || !provinceObjectKeyRef.current || !mapData.objects[provinceObjectKeyRef.current!] || typeof mapData.objects[provinceObjectKeyRef.current!].geometries === 'undefined') {
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData, "provinceObjectKey valid:", !!provinceObjectKeyRef.current, "mapData.objects content:", mapData ? mapData.objects : 'N/A');
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">{fetchError ? (fetchError.includes("offline") ? "Map data could not be loaded. Check internet/Firebase." : fetchError) : `Invalid TopoJSON structure. Check console and ensure '${NEPAL_GEO_URL}' is valid and its first object layer contains geometries. Key used: ${provinceObjectKeyRef.current || 'None'}`}</p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={mapContainerRef}
        className="relative aspect-[16/9] w-full bg-lime-100 dark:bg-green-900/30 rounded-lg shadow-lg overflow-hidden border border-border cursor-default"
        onClick={handleMapContainerClick} // Handle click on map background to close info box
      >
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
              "transition-all duration-200 ease-out opacity-100 scale-100"
            )}
            onClick={(e) => e.stopPropagation()} // Prevent click on card from closing it
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
                <p>Explore {selectedFeatureInfo.feature.name}.</p>
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
                  className="w-full text-xs h-auto py-1.5 border-accent text-accent hover:bg-accent/10 hover:text-accent"
                >
                  <Link href={selectedFeatureInfo.feature.link} target={selectedFeatureInfo.feature.link.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer">
                    Learn More <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        )}

        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 4500, // Adjusted scale for Nepal
            center: [84.1240, 28.3949] // Center of Nepal
          }}
          style={{ width: "100%", height: "100%" }}
          aria-label="Interactive map of Nepal showing provinces and key cities"
        >
          <ZoomableGroup center={[84.1240, 28.3949]} zoom={1} minZoom={0.7} maxZoom={10}>
            <Geographies 
              geography={mapData} 
              parseGeographies={data => {
                console.log("parseGeographies called. provinceObjectKeyRef.current:", provinceObjectKeyRef.current);
                if (!data || typeof data.objects !== 'object' || data.objects === null) {
                  console.error("parseGeographies: Invalid TopoJSON data passed - 'data' or 'data.objects' is problematic.", data);
                  return [];
                }
                const key = provinceObjectKeyRef.current;
                if (!key) {
                  console.error("parseGeographies: provinceObjectKeyRef.current is null or undefined.");
                  return [];
                }
                const layer = data.objects[key];
                if (!layer) {
                  console.error(`parseGeographies: Layer key "${key}" not found in data.objects. Available keys:`, Object.keys(data.objects));
                  return [];
                }
                if (layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                  console.log(`parseGeographies: Returning geometries for layer "${key}"`, layer.geometries.length);
                  return layer.geometries;
                }
                // If it's a single geometry, react-simple-maps can often handle an array containing just that.
                if (["Polygon", "MultiPolygon"].includes(layer.type) && layer.arcs) { // TopoJSON single geometries have arcs
                    console.warn(`parseGeographies: Layer for key "${key}" is a single TopoJSON geometry, not a GeometryCollection. Wrapping it.`);
                    return [layer]; 
                }
                console.error(`parseGeographies: Layer for key "${key}" is not a GeometryCollection with a 'geometries' array, nor a recognized single TopoJSON geometry. Layer type:`, layer.type, "Layer content:", layer);
                return [];
              }}
            >
              {({ geographies }) =>
                geographies.map(geo => {
                  const currentProperties = geo.properties as ProvinceFeatureProperties;
                  const provinceName = currentProperties?.ADM1_EN || currentProperties?.DIST_EN || currentProperties?.NAME_1 || currentProperties?.DISTRICT || currentProperties?.name || `Region ${geo.rsmKey.slice(-4)}`;
                  const geoId = geo.rsmKey;

                  const detailsKey = (provinceName).toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '');
                  const details = provinceDetails[detailsKey] || {};
                  const isSelected = selectedFeatureInfo?.feature.type === "Province" && selectedFeatureInfo.feature.id === geoId;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={(event: React.MouseEvent<SVGPathElement>) => {
                        event.stopPropagation(); // Important: prevent map click from closing info box immediately
                        const featureData: ExtendedProvinceMapData = {
                          id: geoId,
                          name: provinceName,
                          type: "Province",
                          population: details.population,
                          description: details.description || `Explore more about ${provinceName}.`,
                          link: details.link || `/districts?name=${encodeURIComponent(provinceName)}`,
                          properties: currentProperties,
                        };
                        console.log("Geography Clicked:", provinceName, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureData);
                        setSelectedFeatureInfo({
                          feature: featureData,
                          pageX: event.pageX,
                          pageY: event.pageY,
                        });
                      }}
                      className={cn(
                        "outline-none transition-all duration-150 ease-in-out cursor-pointer",
                        isSelected
                          ? "fill-accent/70 dark:fill-accent/60 stroke-accent-foreground/70 dark:stroke-white/70 stroke-[1.2px]"
                          : "fill-card dark:fill-gray-700 hover:fill-accent/40 dark:hover:fill-accent/30 stroke-border dark:stroke-gray-600 stroke-[0.5px]"
                      )}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', fill: isSelected ? "hsl(var(--accent) / 0.7)" : "hsl(var(--accent) / 0.4)" },
                        pressed: { outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>
            {/* Province Labels */}
            {mapData && provinceObjectKeyRef.current && mapData.objects[provinceObjectKeyRef.current] && (
                <Geographies 
                  geography={mapData}
                  parseGeographies={data => {
                      const key = provinceObjectKeyRef.current;
                      const layer = data.objects[key!];
                      if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                          return layer.geometries;
                      }
                      if (layer && ["Polygon", "MultiPolygon"].includes(layer.type) && layer.arcs) {
                          return [layer];
                      }
                      return [];
                  }}
                >
                    {({ geographies }) =>
                    geographies.map(geo => {
                        const properties = geo.properties as ProvinceFeatureProperties;
                        let displayName = properties.ADM1_EN || properties.DIST_EN || properties.NAME_1 || properties.name || '';
                        const centroid = (geo as any).centroid as [number, number] | undefined; // react-simple-maps adds centroid

                        if (!centroid || !displayName) return null;
                        
                        const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi", "Sudurpashchim", "Madhesh", "Karnali"];
                        const isMajorProvinceLabel = showLabelFor.some(p => displayName.includes(p));
                        
                        // Reduce clutter by only showing labels for major provinces or shorter names
                        if (!isMajorProvinceLabel && (!properties.DIST_EN || displayName.length > 12) ) return null; // Example filter

                        displayName = displayName.replace(" Province", "").replace(" District", "");
                        
                        let fontSizeClass = "text-[5px] md:text-[7px]";
                        if (displayName === "Kathmandu" || displayName === "Pokhara" || displayName === "Lumbini") {
                            fontSizeClass = "text-[6px] md:text-[8px]";
                        } else if (isMajorProvinceLabel && displayName.length < 8) {
                            fontSizeClass = "text-[5.5px] md:text-[7.5px]";
                        }


                        return (
                        <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                            <text
                            textAnchor="middle"
                            y={properties.ADM1_EN === "Bagmati" ? 2 : (properties.ADM1_EN === "Madhesh" ? -1 : 0)} // Small y-offset adjustments
                            className={cn(fontSizeClass, "fill-foreground pointer-events-none select-none font-medium")}
                            style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.6px", strokeLinecap: "butt", strokeLinejoin: "miter" }}
                            >
                            {displayName}
                            </text>
                        </Marker>
                        );
                    })
                    }
                </Geographies>
            )}
            {/* Major City Markers */}
            {majorCities.map(city => {
              const cityDetailsForInfo = cityDetails[city.id.toLowerCase()] || {};
              const isSelected = selectedFeatureInfo?.feature.type === "City" && selectedFeatureInfo.feature.id === city.id;
              const isHovered = false; // Hover state for cities could be added if needed

              let fontSize = "text-[5px] md:text-[6px]";
              if (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") {
                  fontSize = "text-[6px] md:text-[8px]";
              }
              
              return (
                <Marker
                  key={city.id}
                  coordinates={city.coordinates}
                  onClick={(event: React.MouseEvent<SVGGElement>) => {
                      event.stopPropagation();
                      const featureData: ExtendedCityMapData = {
                          ...city,
                          population: cityDetailsForInfo.population || city.population,
                          description: cityDetailsForInfo.description || city.description,
                          link: cityDetailsForInfo.link || city.link,
                      };
                      console.log("City marker clicked:", city.name, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureData);
                      setSelectedFeatureInfo({
                          feature: featureData,
                          pageX: event.pageX,
                          pageY: event.pageY,
                      });
                  }}
                >
                  {/* Simple circle marker, removing MapPin icon */}
                  <circle
                    r={isSelected ? 5 : 3}
                    className={cn(
                      "transition-all duration-150 ease-in-out cursor-pointer",
                      isSelected
                          ? "fill-accent stroke-accent-foreground/70"
                          : "fill-primary stroke-primary-foreground/70 hover:fill-accent"
                    )}
                    strokeWidth={0.3}
                  />
                  <text
                    textAnchor="middle"
                    y={-8} // Adjusted y position for text above circle
                    className={cn(
                      "fill-foreground pointer-events-none select-none font-semibold",
                      fontSize,
                       city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini" ? "text-[7px] md:text-[9px]" : "text-[5px] md:text-[6px]"
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

    