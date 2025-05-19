
"use client";

import type { ExtendedCityMapData, ExtendedProvinceMapData, ProvinceFeatureProperties } from '@/types';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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

// const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Using TopoJSON
// For direct GeoJSON FeatureCollection (ensure it's structured correctly)
const NEPAL_GEO_URL = "/data/nepal-districts-geojson.json";


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
  const [mapData, setMapData] = React.useState<any | null>(null); // Stores TopoJSON object or GeoJSON FeatureCollection
  const [provinceDetails, setProvinceDetails] = React.useState<Record<string, Partial<ExtendedProvinceMapData>>>({});
  const [cityDetails, setCityDetails] = React.useState<Record<string, Partial<ExtendedCityMapData>>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const provinceObjectKeyRef = React.useRef<string | null>(null); // For TopoJSON layer name
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
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const rawMapData: any = await geoRes.json();
        console.log("HomepageMap: Raw map data fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");

        // Check if it's TopoJSON
        if (rawMapData.type === "Topology" && rawMapData.objects && Object.keys(rawMapData.objects).length > 0) {
          const firstKey = Object.keys(rawMapData.objects)[0];
          if (!firstKey || !rawMapData.objects[firstKey] || !rawMapData.objects[firstKey].geometries) {
            setFetchError(`Invalid TopoJSON: Layer "${firstKey}" in ${NEPAL_GEO_URL} is not a GeometryCollection or does not contain 'geometries'.`);
            setIsLoading(false);
            return;
          }
          provinceObjectKeyRef.current = firstKey;
          setMapData(rawMapData); // Store the whole TopoJSON object
          console.log("HomepageMap: Map data (TopoJSON) set to state. provinceObjectKey set to:", provinceObjectKeyRef.current);
        } 
        // Check if it's GeoJSON FeatureCollection
        else if (rawMapData.type === "FeatureCollection" && Array.isArray(rawMapData.features)) {
            setMapData(rawMapData); // Store the GeoJSON FeatureCollection
            provinceObjectKeyRef.current = null; // Not needed for direct GeoJSON
            console.log("HomepageMap: Map data (GeoJSON FeatureCollection) set to state.");
        }
        else {
          setFetchError(`Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with 'objects' or GeoJSON FeatureCollection. Received: ${JSON.stringify(rawMapData, null, 2).substring(0, 500)}`);
          setIsLoading(false);
          return;
        }

        // Fetch province details from Firestore
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, Partial<ExtendedProvinceMapData>> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          // Normalize ID: use a common property from GeoJSON if available, or Firestore doc.id
          // For GADM data, ADM1_PCODE or similar might be good. For now, let's assume Firestore ID is related.
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
            errorMsg = "Map data could not be loaded. Please check your internet connection and Firebase setup.";
        }
        setFetchError(errorMsg);
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
        console.log("Map container clicked, closing info box.");
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

  // Check for valid mapData *before* trying to access mapData.objects
  if (fetchError || !mapData) {
    const displayError = fetchError || "Map data is not available.";
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">{displayError.includes("offline") || displayError.includes("firestore/unavailable") ? "Map data could not be loaded due to a connection issue. Please check your internet and Firebase setup." : displayError}</p>
      </div>
    );
  }

  // Further check specifically for TopoJSON structure if provinceObjectKeyRef is set
  if (provinceObjectKeyRef.current && (!mapData.objects || !mapData.objects[provinceObjectKeyRef.current])) {
    console.error("HomepageMap: TopoJSON object key invalid or missing. provinceObjectKeyRef.current:", provinceObjectKeyRef.current, "mapData.objects:", mapData.objects);
     return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Structure Error</p>
        <p className="text-xs">The TopoJSON file is missing the expected object layer: {provinceObjectKeyRef.current}. Check TopoJSON structure.</p>
      </div>
    );
  }

  const geographiesSource = provinceObjectKeyRef.current ? mapData : (mapData.features ? mapData : null);
  if (!geographiesSource) {
    console.error("HomepageMap: Could not determine valid geographies source from mapData.", mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">Unable to render map features. Check map data file and console.</p>
      </div>
    );
  }

  const DebugStateIndicator = () => {
    if (!selectedFeatureInfo) return null;
    return (
      <div style={{
        position: 'fixed', top: '5px', left: '5px', padding: '10px',
        background: 'yellow', border: '2px solid red', zIndex: 100000,
        color: 'black', fontSize: '12px', fontWeight: 'bold',
      }}>
        STATE DEBUG: Clicked on {selectedFeatureInfo.feature.name} (Type: {selectedFeatureInfo.feature.type}) at X: {selectedFeatureInfo.pageX}, Y: {selectedFeatureInfo.pageY}
      </div>
    );
  };

  return (
    <>
      <DebugStateIndicator /> {/* TOP-LEVEL DEBUGGER */}
      <div
        ref={mapContainerRef}
        className="relative aspect-[16/9] w-full bg-lime-100 dark:bg-green-900/30 rounded-lg shadow-lg overflow-hidden border border-border"
        onClick={handleMapContainerClick}
      >
        {selectedFeatureInfo && (
          <div
            style={{
              position: 'fixed',
              left: `${selectedFeatureInfo.pageX + 10}px`,
              top: `${selectedFeatureInfo.pageY + 10}px`,
              width: '220px',
              padding: '12px',
              background: 'hsl(var(--background))', // Use theme background
              color: 'hsl(var(--foreground))',     // Use theme foreground
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 9999, // Ensure it's on top
              pointerEvents: 'auto',
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out', // For smooth appearance
              opacity: 1,
              transform: 'scale(1)',
            }}
            className={cn(
                 mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.clientWidth - 250 // 220px width + 30px buffer
                 ? 'translate-x-[calc(-100%-20px)]' // Shift left if too close to right edge
                 : 'translate-x-0'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedFeatureInfo(null)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0'
              }}
              aria-label="Close info box"
            >
              <XIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
            <h3 className="text-sm font-semibold text-primary mb-1 flex items-center">
                <MapPin className="h-4 w-4 mr-1.5 text-primary/80" />
                {selectedFeatureInfo.feature.name}
            </h3>
            {selectedFeatureInfo.feature.description && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-3">
                {selectedFeatureInfo.feature.description}
              </p>
            )}
            {selectedFeatureInfo.feature.link && (
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
            )}
          </div>
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
            {geographiesSource && ( // Ensure geographiesSource is not null
              <Geographies geography={geographiesSource} parseGeographies={data => provinceObjectKeyRef.current ? data.objects[provinceObjectKeyRef.current!].geometries : data.features}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const currentProperties = geo.properties as ProvinceFeatureProperties;
                    const provinceName = currentProperties.ADM1_EN || currentProperties.DIST_EN || currentProperties.NAME_1 || currentProperties.name || `Region ${geo.rsmKey.slice(-4)}`;
                    const geoId = geo.rsmKey;

                    const detailsKey = (provinceName).toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '');
                    const details = provinceDetails[detailsKey] || {};
                    const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === "Province";

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
            )}
            {/* Province Labels */}
             {geographiesSource && (
                <Geographies geography={geographiesSource} parseGeographies={data => provinceObjectKeyRef.current ? data.objects[provinceObjectKeyRef.current!].geometries : data.features}>
                    {({ geographies }) =>
                    geographies.map(geo => {
                        const properties = geo.properties as ProvinceFeatureProperties;
                        let displayName = properties.ADM1_EN || properties.DIST_EN || properties.NAME_1 || properties.name || '';
                        const centroid = (geo as any).centroid as [number, number] | undefined;

                        if (!centroid || !displayName) return null;
                        
                        const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi", "Sudurpashchim", "Madhesh", "Karnali"];
                        const isMajorProvinceLabel = showLabelFor.some(p => displayName.includes(p));
                        
                        // Show label if it's a major province OR if it's a district name (DIST_EN) and not too long
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
                      console.log("City Marker Clicked:", city.name, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureData);
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
                    y={
                      (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini")
                        ? -10
                        : -8
                    }
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
