
"use client";

import type { GeoJSON as LocalGeoJSON, ProvinceFeatureProperties } from '@/types';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { InfoIcon, ExternalLink, XIcon, MapPin, Users } from 'lucide-react';
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

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";

interface ExtendedProvinceMapData {
  id: string;
  name: string;
  type: "Province";
  population?: number;
  description?: string;
  link?: string;
  properties: ProvinceFeatureProperties;
}

interface ExtendedCityMapData {
  id: string;
  name: string;
  coordinates: [number, number];
  type: "City";
  population?: number;
  description?: string;
  link?: string;
  highlight?: boolean;
  properties: any;
}

type SelectedFeatureInfo = {
  feature: ExtendedProvinceMapData | ExtendedCityMapData;
  pageX: number;
  pageY: number;
} | null;

const majorCities: ExtendedCityMapData[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], type: "City", description: "Capital city, rich in culture and ancient temples.", link: "/districts?name=Kathmandu", population: 1442271, highlight: true, properties: {} },
  { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], type: "City", description: "City of lakes, with stunning Himalayan views.", link: "/districts?name=Kaski", population: 400000, highlight: true, properties: {} },
  { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], type: "City", description: "Birthplace of Lord Buddha, a sacred pilgrimage site.", link: "/districts?name=Rupandehi", population: 100000, highlight: true, properties: {} },
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
    console.log("HomepageMap: DEBUG - selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        console.log("HomepageMap: DEBUG - Starting to fetch TopoJSON...");
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch TopoJSON from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const topoJsonData: any = await geoRes.json();
        
        console.log("HomepageMap: DEBUG - TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(topoJsonData, null, 2).substring(0, 500) + "...");

        if (typeof topoJsonData !== 'object' || topoJsonData === null || !topoJsonData.objects || Object.keys(topoJsonData.objects).length === 0) {
          setFetchError(`Invalid TopoJSON structure in ${NEPAL_GEO_URL}: 'objects' property is missing, empty, or file is not valid JSON. Received: ${JSON.stringify(topoJsonData, null, 2).substring(0, 500)}`);
          setIsLoading(false);
          return;
        }
        
        const firstKey = Object.keys(topoJsonData.objects)[0];
        if (!firstKey || !topoJsonData.objects[firstKey] || !(topoJsonData.objects[firstKey].type === "GeometryCollection" && Array.isArray(topoJsonData.objects[firstKey].geometries))) {
             setFetchError(`Invalid TopoJSON: Layer "${firstKey}" in ${NEPAL_GEO_URL} is not a GeometryCollection or does not contain 'geometries'. Expected format: { "type": "Topology", "objects": { "your_layer_name": { "type": "GeometryCollection", "geometries": [...] } }, "arcs": [...] }.`);
             setIsLoading(false);
             return;
        }
        provinceObjectKeyRef.current = firstKey;
        setMapData(topoJsonData);
        console.log("HomepageMap: DEBUG - Map data (TopoJSON) set to state.");

        // Firestore fetching (simplified for brevity, ensure db is initialized)
        console.log("HomepageMap: DEBUG - Fetching province details from Firestore...");
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, Partial<ExtendedProvinceMapData>> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          const normalizedId = (data.id?.toLowerCase() || doc.id.toLowerCase()).replace(/\s+/g, '_').replace(/_province$/, '');
          provData[normalizedId] = { population: data.population, description: data.description, link: data.link };
        });
        setProvinceDetails(provData);
        console.log("HomepageMap: DEBUG - Province details fetched and set.");

        console.log("HomepageMap: DEBUG - Fetching city details from Firestore...");
        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityDataColl: Record<string, Partial<ExtendedCityMapData>> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          cityDataColl[doc.id.toLowerCase()] = { population: data.population, description: data.description, link: data.link };
        });
        setCityDetails(cityDataColl);
        console.log("HomepageMap: DEBUG - City details fetched and set.");

      } catch (error) {
        console.error("HomepageMap: DEBUG - Error during data fetching:", error);
        let errorMsg = error instanceof Error ? error.message : "An unknown error occurred while loading map data.";
        // ... (rest of error message formatting)
        setFetchError(errorMsg);
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: DEBUG - Data fetching finished, isLoading set to false.");
      }
    };
    fetchData();
  }, []);
  
  const handleMapContainerClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
     if (event.target === event.currentTarget) {
        console.log("HomepageMap: DEBUG - Map background clicked, setting selectedFeatureInfo to null.");
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
    console.error("HomepageMap: DEBUG - Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData, "provinceObjectKey valid:", !!provinceObjectKeyRef.current);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">
          {fetchError || `Could not load or parse map data. Ensure public/data/nepal-provinces-topo.json is correct and Firebase data is accessible.`}
        </p>
         <p className="text-xs mt-2">
            {fetchError && (fetchError.includes("offline") || fetchError.includes("Failed to get document")) 
                ? "Please check your Firebase configuration and internet connection." 
                : "Verify the TopoJSON file structure in public/data/ and check console logs for more details."}
        </p>
      </div>
    );
  }
  
  if (selectedFeatureInfo) {
    console.log("HomepageMap: DEBUG - Rendering info box for:", selectedFeatureInfo.feature.name, "at", selectedFeatureInfo.pageX, selectedFeatureInfo.pageY);
  }


  return (
    <div
      ref={mapContainerRef}
      className="relative aspect-[16/9] w-full bg-green-100 dark:bg-green-900/30 rounded-lg shadow-lg overflow-hidden border border-border"
      onClick={handleMapContainerClick}
    >
      {selectedFeatureInfo && selectedFeatureInfo.feature && (
        <Card
          className={cn(
            "fixed p-3 w-64 shadow-xl border-4 border-yellow-500 z-[99999]", // Extremely high z-index
            "bg-pink-500 text-white font-bold" // Unmistakable debug styles
          )}
          style={{
            // Temporarily fixed position for debugging visibility
            left: `20px`,
            top: `20px`,
            // Original cursor-based positioning (commented out for debug):
            // left: `${selectedFeatureInfo.pageX + 15}px`,
            // top: `${selectedFeatureInfo.pageY + 15}px`,
            // transform: selectedFeatureInfo.pageX > (mapContainerRef.current?.clientWidth ?? window.innerWidth) - 280 // 256px (w-64) + 2 * 12px padding approx
            //   ? 'translateX(calc(-100% - 30px))'
            //   : 'translateX(0px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="p-1 flex flex-row items-start justify-between space-y-0 mb-1">
            <CardTitle className="text-base text-yellow-300 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              {selectedFeatureInfo.feature.name}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-yellow-200 hover:text-white" onClick={() => { console.log("HomepageMap: DEBUG - Close button clicked"); setSelectedFeatureInfo(null);}} aria-label="Close info box">
                <XIcon className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-1 text-xs space-y-0.5">
            <p className="text-yellow-100">DEBUG: Type: {selectedFeatureInfo.feature.type}</p>
            {selectedFeatureInfo.feature.description && (
                <p className="text-yellow-100 line-clamp-2">{selectedFeatureInfo.feature.description}</p>
            )}
             {selectedFeatureInfo.feature.population !== undefined && (
              <p className="text-yellow-100 flex items-center text-xs">
                <Users className="mr-1 h-3 w-3 flex-shrink-0" />
                Pop: {Number(selectedFeatureInfo.feature.population).toLocaleString()}
              </p>
            )}
            <p className="text-yellow-100 text-xs">DEBUG Coords: X: {selectedFeatureInfo.pageX}, Y: {selectedFeatureInfo.pageY}</p>
          </CardContent>
          {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-1 pt-1 mt-1 border-t border-yellow-400/50">
                <Button asChild variant="link" size="sm" className="w-full text-yellow-200 hover:text-white text-xs h-7 justify-start p-0">
                  <Link href={selectedFeatureInfo.feature.link} target="_blank" rel="noopener noreferrer">
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
              <Geographies geography={mapData} object={mapData.objects[provinceObjectKeyRef.current]}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const currentProperties = geo.properties as ProvinceFeatureProperties;
                    const isSelected = selectedFeatureInfo?.feature.type === "Province" && selectedFeatureInfo.feature.id === geo.rsmKey;
                    const geoId = (currentProperties.ADM1_EN || currentProperties.DIST_EN || geo.rsmKey.toString()).toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '');
                    const details = provinceDetails[geoId] || {};
                    
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={(event: React.MouseEvent<SVGPathElement>) => {
                          event.stopPropagation(); 
                          const displayName = currentProperties.DIST_EN || currentProperties.ADM1_EN || `Region ${geo.rsmKey.slice(-4)}`;
                          const linkName = currentProperties.DIST_EN ? displayName : (currentProperties.ADM1_EN || displayName);
                          
                          console.log("HomepageMap: DEBUG - Geography clicked:", displayName, "Properties:", currentProperties, "Event pageX:", event.pageX, "pageY:", event.pageY, "geo.rsmKey:", geo.rsmKey);

                          setSelectedFeatureInfo({
                            feature: {
                              id: geo.rsmKey, // Use unique rsmKey for ID
                              name: displayName,
                              type: "Province",
                              population: details.population,
                              description: details.description,
                              link: details.link || `/districts?name=${encodeURIComponent(linkName)}`,
                              properties: currentProperties,
                            },
                            pageX: event.pageX,
                            pageY: event.pageY,
                          });
                        }}
                        className={cn(
                          "stroke-border dark:stroke-gray-500 stroke-[0.5px] outline-none transition-all duration-150 ease-in-out cursor-pointer",
                          isSelected
                              ? "fill-accent/70 dark:fill-accent/60 stroke-accent-foreground/70 dark:stroke-white/70 stroke-[1.5px]"
                              : "fill-card dark:fill-gray-700 hover:fill-accent/30 dark:hover:fill-accent/40"
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
              <Geographies geography={mapData} object={mapData.objects[provinceObjectKeyRef.current]}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const properties = geo.properties as ProvinceFeatureProperties;
                    const districtNameProp = properties.DIST_EN || properties.NAME_2 || properties.ADM2_EN;
                    const provinceLevelNameProp = properties.ADM1_EN || properties.NAME_1;
                    let displayName = districtNameProp || provinceLevelNameProp;

                    const centroid = (geo as any).centroid as [number, number] | undefined; 

                    const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi", "Sudurpashchim", "Madhesh", "Karnali"];
                     if (!centroid || !displayName ) return null;

                    const isMajorProvinceLabel = provinceLevelNameProp && showLabelFor.some(p => provinceLevelNameProp.includes(p));
                    const isMajorCityLabel = majorCities.some(mc => mc.name === displayName);

                    if (!isMajorProvinceLabel && !isMajorCityLabel) { // Only show labels for specified provinces or major cities
                        // For other districts, you might want a smaller, conditional label or none
                        // Example: if (properties.DIST_EN && properties.DIST_EN.length < 10) { /* render smaller label */ } else return null;
                        return null;
                    }
                    displayName = displayName.replace(" Province", "").replace(" District", "");


                    let fontSizeClass = "text-[4px] md:text-[6px]"; // Default smaller size
                    if (isMajorProvinceLabel || isMajorCityLabel) {
                         fontSizeClass = "text-[5px] md:text-[7px]";
                    }
                    if (displayName === "Kathmandu" || displayName === "Pokhara" || displayName === "Lumbini") {
                        fontSizeClass = "text-[6px] md:text-[8px]"; 
                    }


                    return (
                      <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                        <text
                          textAnchor="middle"
                          y={properties.ADM1_EN === "Bagmati" ? 2 : (properties.ADM1_EN === "Madhesh" ? -1 : 0)} // Small adjustments for specific provinces
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
                      console.log("HomepageMap: DEBUG - City marker clicked:", city.name, "Event pageX:", event.pageX, "pageY:", event.pageY);
                      setSelectedFeatureInfo({
                          feature: {
                              ...city, 
                              population: cityDetailsForInfo.population || city.population,
                              description: cityDetailsForInfo.description || city.description,
                              link: cityDetailsForInfo.link || city.link,
                          },
                          pageX: event.pageX,
                          pageY: event.pageY,
                      });
                  }}
                >
                  <circle
                    r={isSelected ? 5 : 3.5} 
                    className={cn(
                      "transition-all duration-150 ease-in-out cursor-pointer",
                      isSelected
                          ? "fill-accent stroke-accent-foreground/70"
                          : "fill-primary/70 stroke-primary-foreground/70 hover:fill-accent/70"
                    )}
                    strokeWidth={0.3}
                  />
                  <text
                    textAnchor="middle"
                    y={-7} 
                    className={cn(
                      "fill-foreground pointer-events-none select-none font-semibold",
                      "text-[5px] md:text-[7px]" 
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


    