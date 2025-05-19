
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

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Reverted to TopoJSON

type SelectedFeatureInfo = {
  feature: ExtendedProvinceMapData | ExtendedCityMapData;
  pageX: number;
  pageY: number;
} | null;

// Default major cities for highlighting
const majorCities: ExtendedCityMapData[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], type: "City", description: "Capital city, rich in culture and ancient temples.", link: "/districts?name=Kathmandu", population: 1442271, properties: {} },
  { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], type: "City", description: "City of lakes, with stunning Himalayan views.", link: "/districts?name=Kaski", population: 400000, properties: {} },
  { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], type: "City", description: "Birthplace of Lord Buddha, a sacred pilgrimage site.", link: "/districts?name=Rupandehi", population: 100000, properties: {} },
];

export function HomepageMap() {
  const [selectedFeatureInfo, setSelectedFeatureInfo] = React.useState<SelectedFeatureInfo>(null);
  const [mapData, setMapData] = React.useState<any | null>(null); // Will store the full TopoJSON object
  const provinceObjectKeyRef = React.useRef<string | null>(null); // To store the key for the TopoJSON objects layer
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
      console.log("HomepageMap: Starting to fetch map data from", NEPAL_GEO_URL);
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          console.error(`HomepageMap: Failed to fetch ${NEPAL_GEO_URL}. Status: ${geoRes.status}. Response: ${errorText.substring(0, 200)}...`);
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Please ensure the file exists in public/data/ and is correctly named.`);
        }
        const rawMapData: any = await geoRes.json();
        console.log("HomepageMap: Raw map data fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");

        if (rawMapData.type === "Topology" && rawMapData.objects && Object.keys(rawMapData.objects).length > 0) {
          const firstKey = Object.keys(rawMapData.objects)[0];
          if (!firstKey || !rawMapData.objects[firstKey] || typeof rawMapData.objects[firstKey].geometries === 'undefined') {
            console.error("HomepageMap: Invalid TopoJSON structure. The first object layer does not contain 'geometries'. Layer key:", firstKey, "Object content:", rawMapData.objects[firstKey]);
            setFetchError(`Invalid TopoJSON: Layer "${firstKey}" in ${NEPAL_GEO_URL} is not a GeometryCollection or does not contain 'geometries'. Check file content.`);
            setIsLoading(false);
            setMapData(null); // Explicitly set mapData to null on error
            return;
          }
          provinceObjectKeyRef.current = firstKey;
          setMapData(rawMapData);
          console.log("HomepageMap: Map data (TopoJSON) set to state. provinceObjectKey set to:", provinceObjectKeyRef.current);
        } else {
          console.error("HomepageMap: Invalid map data structure. Expected TopoJSON with 'objects'. Received:", rawMapData);
          setFetchError(`Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with a valid 'objects' property. Please check the file format.`);
          setMapData(null); // Explicitly set mapData to null on error
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
        setMapData(null); // Ensure mapData is null on error
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: Data fetching finished, isLoading set to false.");
      }
    };
    fetchData();
  }, []);

  const handleMapContainerClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
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
  
  if (fetchError || !mapData || !provinceObjectKeyRef.current || !mapData.objects[provinceObjectKeyRef.current]) {
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData, "provinceObjectKey valid:", !!provinceObjectKeyRef.current, "mapData.objects content:", mapData ? mapData.objects : 'N/A');
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">{fetchError ? (fetchError.includes("offline") ? "Map data could not be loaded due to a connection issue. Please check your internet and Firebase setup." : fetchError) : `Invalid map data structure. Check console and ensure '${NEPAL_GEO_URL}' is a valid TopoJSON file in your public/data directory.`}</p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={mapContainerRef}
        className="relative aspect-[16/9] w-full bg-lime-100 dark:bg-green-900/30 rounded-lg shadow-lg overflow-hidden border border-border cursor-default"
        onClick={handleMapContainerClick}
      >
        {selectedFeatureInfo && (
          <Card
            style={{
              position: 'fixed',
              left: `${selectedFeatureInfo.pageX + 15}px`,
              top: `${selectedFeatureInfo.pageY + 15}px`,
              transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.clientWidth - 270 // 256px width + 14px buffer
                ? 'translateX(calc(-100% - 30px))'
                : 'translateX(0)',
            }}
            className={cn(
              "p-0 w-64 shadow-xl border-border z-[60] rounded-md bg-card text-card-foreground",
              "transition-all duration-200 ease-out",
              selectedFeatureInfo ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            )}
            onClick={(e) => e.stopPropagation()}
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
            scale: 4500,
            center: [84.1240, 28.3949]
          }}
          style={{ width: "100%", height: "100%" }}
          aria-label="Interactive map of Nepal showing provinces and key cities"
        >
          <ZoomableGroup center={[84.1240, 28.3949]} zoom={1} minZoom={0.7} maxZoom={10}>
            <Geographies 
              geography={mapData} 
              parseGeographies={data => data.objects[provinceObjectKeyRef.current!].geometries}
            >
              {({ geographies }) =>
                geographies.map(geo => {
                  const currentProperties = geo.properties as ProvinceFeatureProperties;
                  // Try multiple common property names for province/district name
                  const provinceName = currentProperties.ADM1_EN || currentProperties.DIST_EN || currentProperties.NAME_1 || currentProperties.DISTRICT || currentProperties.name || `Region ${geo.rsmKey.slice(-4)}`;
                  const geoId = geo.rsmKey;

                  const detailsKey = (provinceName).toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '');
                  const details = provinceDetails[detailsKey] || {};
                  const isSelected = selectedFeatureInfo?.feature.type === "Province" && selectedFeatureInfo.feature.id === geoId;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={(event: React.MouseEvent<SVGPathElement>) => {
                        event.stopPropagation();
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
                        "stroke-border dark:stroke-gray-600 stroke-[0.5px] outline-none transition-all duration-150 ease-in-out cursor-pointer",
                        isSelected
                          ? "fill-accent/70 dark:fill-accent/60 stroke-accent-foreground/70 dark:stroke-white/70 stroke-[1.2px]"
                          : "fill-card dark:fill-gray-700 hover:fill-accent/40 dark:hover:fill-accent/30"
                      )}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>
            {/* Province Labels */}
            <Geographies 
              geography={mapData}
              parseGeographies={data => data.objects[provinceObjectKeyRef.current!].geometries}
            >
                {({ geographies }) =>
                geographies.map(geo => {
                    const properties = geo.properties as ProvinceFeatureProperties;
                    let displayName = properties.ADM1_EN || properties.DIST_EN || properties.NAME_1 || properties.name || '';
                    const centroid = (geo as any).centroid as [number, number] | undefined;

                    if (!centroid || !displayName) return null;
                    
                    const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi", "Sudurpashchim", "Madhesh", "Karnali"];
                    const isMajorProvinceLabel = showLabelFor.some(p => displayName.includes(p));
                    
                    if (!isMajorProvinceLabel && (!properties.DIST_EN || displayName.length > 12) ) return null;

                    displayName = displayName.replace(" Province", "").replace(" District", "");
                    
                    let fontSizeClass = "text-[5px] md:text-[7px]";
                     if (displayName === "Kathmandu" || displayName === "Pokhara" || displayName === "Lumbini") {
                        fontSizeClass = "text-[6px] md:text-[8px]";
                    }

                    return (
                    <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                        <text
                        textAnchor="middle"
                        y={properties.ADM1_EN === "Bagmati" ? 2 : (properties.ADM1_EN === "Madhesh" ? -1 : 0)}
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
            {/* Major City Markers */}
            {majorCities.map(city => {
              const cityDetailsForInfo = cityDetails[city.id.toLowerCase()] || {};
              const isSelected = selectedFeatureInfo?.feature.type === "City" && selectedFeatureInfo.feature.id === city.id;

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
                  <circle
                    r={isSelected ? 6 : 4}
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
                    y={ (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") ? -10 : -8 }
                    className={cn(
                      "fill-foreground pointer-events-none select-none font-semibold",
                      fontSize
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
