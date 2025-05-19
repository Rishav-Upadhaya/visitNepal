
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

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";

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
  const [provinceDetails, setProvinceDetails] = React.useState<Record<string, Partial<ExtendedProvinceMapData>>>({});
  const [cityDetails, setCityDetails] = React.useState<Record<string, Partial<ExtendedCityMapData>>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const provinceObjectKeyRef = React.useRef<string | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      console.log("HomepageMap: Starting to fetch map data...");
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch TopoJSON from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const topoJsonData: any = await geoRes.json();
        
        console.log("HomepageMap: TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(topoJsonData, null, 2).substring(0, 200) + "...");

        if (typeof topoJsonData !== 'object' || topoJsonData === null || !topoJsonData.objects || Object.keys(topoJsonData.objects).length === 0) {
          setFetchError(`Invalid TopoJSON structure in ${NEPAL_GEO_URL}: 'objects' property is missing, empty, or file is not valid JSON. Received: ${JSON.stringify(topoJsonData, null, 2).substring(0, 500)}`);
          setIsLoading(false);
          return;
        }
        
        const firstKey = Object.keys(topoJsonData.objects)[0];
        if (!firstKey || !topoJsonData.objects[firstKey] || !topoJsonData.objects[firstKey].geometries) {
             setFetchError(`Invalid TopoJSON: Layer "${firstKey}" in ${NEPAL_GEO_URL} is not a GeometryCollection or does not contain 'geometries'. Expected format: { "type": "Topology", "objects": { "your_layer_name": { "type": "GeometryCollection", "geometries": [...] } }, "arcs": [...] }.`);
             setIsLoading(false);
             return;
        }
        provinceObjectKeyRef.current = firstKey;
        setMapData(topoJsonData);
        console.log("HomepageMap: Map data (TopoJSON) set to state. provinceObjectKeyRef set to:", provinceObjectKeyRef.current);

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

        // Fetch city details from Firestore
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
          errorMsg = "Failed to connect to the data source. Please check your internet connection and Firebase setup.";
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
     // Only close if the click is directly on the map container and not on an info box or its elements
     if (event.target === event.currentTarget) {
        setSelectedFeatureInfo(null);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/10 dark:bg-muted/20 rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
         <p className="absolute text-primary font-semibold">Loading Interactive Map of Nepal...</p>
      </div>
    );
  }
  
  if (fetchError || !mapData || !provinceObjectKeyRef.current || !mapData.objects[provinceObjectKeyRef.current]) {
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData, "provinceObjectKey valid:", !!provinceObjectKeyRef.current, "mapData.objects content:", mapData ? mapData.objects : 'N/A');
    const displayError = fetchError?.includes("offline") || fetchError?.includes("Failed to get document") || fetchError?.includes("firestore/unavailable") || fetchError?.includes("Firebase")
      ? "Map data could not be loaded. Please check your internet connection and Firebase setup."
      : fetchError || `Could not load or parse map data. Ensure /public/data/nepal-provinces-topo.json is correct and Firebase data is accessible.`;
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">{displayError}</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="relative aspect-[16/9] w-full bg-lime-100 dark:bg-green-900/30 rounded-lg shadow-lg overflow-hidden border border-border"
      onClick={handleMapContainerClick}
    >
      {selectedFeatureInfo && (
        <Card
          style={{
            position: 'fixed',
            left: `${selectedFeatureInfo.pageX + 15}px`,
            top: `${selectedFeatureInfo.pageY + 15}px`,
            transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.clientWidth - 280 ? 'translateX(calc(-100% - 30px))' : 'translateX(0px)',
          }}
          className={cn(
            "p-0 w-64 shadow-xl border border-border z-[60] rounded-md bg-card text-card-foreground",
             // Basic transition for appearance
            "transition-all duration-200 ease-out",
            selectedFeatureInfo ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}
          onClick={(e) => e.stopPropagation()} // Prevent map click from closing it
        >
          <CardHeader className="flex flex-row items-center justify-between p-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              {selectedFeatureInfo.feature.name}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setSelectedFeatureInfo(null)}>
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </CardHeader>
          <CardContent className="p-3 text-xs">
            {selectedFeatureInfo.feature.description && (
              <p className="text-muted-foreground line-clamp-3">{selectedFeatureInfo.feature.description}</p>
            )}
            {!selectedFeatureInfo.feature.description && selectedFeatureInfo.feature.type === "Province" && (
                <p className="text-muted-foreground italic">Detailed information about {selectedFeatureInfo.feature.name} coming soon.</p>
            )}
            {!selectedFeatureInfo.feature.description && selectedFeatureInfo.feature.type === "City" && (
                 <p className="text-muted-foreground italic">More details about {selectedFeatureInfo.feature.name} will be available soon.</p>
            )}
             {selectedFeatureInfo.feature.population && (
              <p className="mt-1.5 text-muted-foreground">Population: {selectedFeatureInfo.feature.population.toLocaleString()}</p>
            )}
          </CardContent>
          {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 pt-0">
              <Button asChild variant="outline" size="sm" className="w-full text-xs h-auto py-1.5 border-primary text-primary hover:bg-primary/10 hover:text-primary">
                <Link href={selectedFeatureInfo.feature.link} target={selectedFeatureInfo.feature.link.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer">
                  Learn More <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
      <div className="h-full w-full">
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
            {mapData && provinceObjectKeyRef.current && mapData.objects[provinceObjectKeyRef.current] && (
              <Geographies geography={mapData} >
                {({ geographies }) =>
                  geographies.map(geo => {
                    const currentProperties = geo.properties as ProvinceFeatureProperties;
                    const provinceName = currentProperties.DIST_EN || currentProperties.ADM1_EN || `Region ${geo.rsmKey.slice(-4)}`;
                    const geoId = geo.rsmKey;
                    
                    const details = provinceDetails[(provinceName).toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '')] || {};
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
                            description: details.description,
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
                          "stroke-border stroke-[0.5px] outline-none transition-all duration-150 ease-in-out cursor-pointer",
                          isSelected
                              ? "fill-accent/70 dark:fill-accent/60 stroke-accent-foreground/70 dark:stroke-white/70 stroke-[1.5px]"
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
            {mapData && provinceObjectKeyRef.current && mapData.objects[provinceObjectKeyRef.current] && (
              <Geographies geography={mapData}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const properties = geo.properties as ProvinceFeatureProperties;
                    let displayName = properties.ADM1_EN || properties.DIST_EN || properties.NAME_1; // Prioritize ADM1_EN or specific District Name
                    const centroid = (geo as any).centroid as [number, number] | undefined; 
                    
                    if (!centroid || !displayName) return null;

                    const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi", "Sudurpashchim", "Madhesh", "Karnali"];
                    const isMajorProvinceLabel = showLabelFor.some(p => displayName.includes(p));
                    if (!isMajorProvinceLabel) return null; 

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
            )}
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
                        ? -10 // Slightly more offset for larger fonts
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
      </div>
       <div className="absolute bottom-2 right-2 bg-background/80 p-1.5 rounded shadow text-[0.6rem] text-muted-foreground">
        Map data &copy; <a href="https://gadm.org/" target="_blank" rel="noopener noreferrer" className="hover:underline text-accent">GADM</a> (simplified). City data indicative.
      </div>
    </div>
  );
}
