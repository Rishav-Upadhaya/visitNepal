
"use client";

import type { GeoJSON as LocalGeoJSON, ProvinceFeatureProperties, ExtendedProvinceMapData, ExtendedCityMapData } from '@/types';
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
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      console.log("HomepageMap: DEBUG - Starting to fetch map data...");
      try {
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
        console.log("HomepageMap: DEBUG - Map data (TopoJSON) set to state. provinceObjectKeyRef set to:", provinceObjectKeyRef.current);

        // Fetch province details from Firestore
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, Partial<ExtendedProvinceMapData>> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          const normalizedId = (data.id?.toLowerCase() || doc.id.toLowerCase()).replace(/\s+/g, '_').replace(/_province$/, '');
          provData[normalizedId] = { population: data.population, description: data.description, link: data.link };
        });
        setProvinceDetails(provData);
        console.log("HomepageMap: DEBUG - Province details fetched and set:", provData);

        // Fetch city details from Firestore
        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityDataColl: Record<string, Partial<ExtendedCityMapData>> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          cityDataColl[doc.id.toLowerCase()] = { population: data.population, description: data.description, link: data.link };
        });
        setCityDetails(cityDataColl);
        console.log("HomepageMap: DEBUG - City details fetched and set:", cityDataColl);

      } catch (error) {
        console.error("HomepageMap: DEBUG - Error during data fetching:", error);
        let errorMsg = error instanceof Error ? error.message : "An unknown error occurred while loading map data.";
        if (errorMsg.includes("offline") || errorMsg.includes("Failed to get document") || errorMsg.includes("firestore/unavailable")) {
          errorMsg = "Failed to connect to the data source. Please check your internet connection and Firebase setup.";
        }
        setFetchError(errorMsg);
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: DEBUG - Data fetching finished, isLoading set to false.");
      }
    };
    fetchData();
  }, []);
  
  React.useEffect(() => {
    console.log("HomepageMap: DEBUG - selectedFeatureInfo state updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);

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
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData, "provinceObjectKey valid:", !!provinceObjectKeyRef.current, "mapData.objects content:", mapData ? mapData.objects : 'N/A');
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">
          {fetchError || `Could not load or parse map data. Ensure /public/data/nepal-provinces-topo.json is correct and Firebase data is accessible.`}
        </p>
         <p className="text-xs mt-2">
            {fetchError && (fetchError.includes("offline") || fetchError.includes("Failed to get document") || fetchError.includes("Firebase")) 
                ? "Please check your Firebase configuration and internet connection." 
                : "Verify the TopoJSON file structure in public/data/ and check console logs for more details."}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="relative aspect-[16/9] w-full bg-lime-100 dark:bg-green-900/30 rounded-lg shadow-lg overflow-hidden border border-border"
      onClick={handleMapContainerClick}
    >
      {selectedFeatureInfo && selectedFeatureInfo.feature && (
        <div
          style={{
            position: 'fixed',
            left: `${selectedFeatureInfo.pageX + 15}px`,
            top: `${selectedFeatureInfo.pageY + 15}px`,
            transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.clientWidth - 280 ? 'translateX(calc(-100% - 30px))' : 'translateX(0px)',
            width: '256px', // Equivalent to w-64
            zIndex: 50, // Tailwind z-50
          }}
          className={cn(
            "p-0 shadow-xl border border-border rounded-md",
            "bg-card text-card-foreground"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="p-3 flex flex-row items-start justify-between space-y-0 mb-1 bg-muted/50 rounded-t-md">
            <CardTitle className="text-base font-semibold text-primary flex items-center gap-1.5">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              {selectedFeatureInfo.feature.name}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => setSelectedFeatureInfo(null)} aria-label="Close info box">
                <XIcon className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-3 text-xs space-y-1">
            <p className="text-muted-foreground">Type: {selectedFeatureInfo.feature.type}</p>
            {selectedFeatureInfo.feature.description && (
                <p className="text-muted-foreground line-clamp-2">{selectedFeatureInfo.feature.description}</p>
            )}
             {selectedFeatureInfo.feature.population !== undefined && (
              <p className="text-muted-foreground flex items-center text-xs">
                <Users className="mr-1 h-3 w-3 flex-shrink-0" />
                Pop: {Number(selectedFeatureInfo.feature.population).toLocaleString()}
              </p>
            )}
          </CardContent>
          {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 pt-2 mt-1 border-t border-border">
                <Button asChild variant="outline" size="sm" className="w-full text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground text-xs h-7 justify-start p-1.5">
                  <Link href={selectedFeatureInfo.feature.link} target={selectedFeatureInfo.feature.link.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer">
                    Learn More <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
            </CardFooter>
          )}
        </div>
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
                    const geoId = (currentProperties.ADM1_EN || currentProperties.DIST_EN || geo.rsmKey.toString()).toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '');
                    const details = provinceDetails[geoId] || {};
                    const isSelected = selectedFeatureInfo?.feature.type === "Province" && selectedFeatureInfo.feature.id === geo.rsmKey;
                    
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={(event: React.MouseEvent<SVGPathElement>) => {
                          event.stopPropagation(); 
                          const displayName = currentProperties.DIST_EN || currentProperties.ADM1_EN || `Region ${geo.rsmKey.slice(-4)}`;
                          const linkName = currentProperties.DIST_EN ? displayName : (currentProperties.ADM1_EN || displayName);
                          
                          const featureData: ExtendedProvinceMapData = {
                            id: geo.rsmKey,
                            name: displayName,
                            type: "Province",
                            population: details.population,
                            description: details.description,
                            link: details.link || `/districts?name=${encodeURIComponent(linkName)}`,
                            properties: currentProperties,
                          };
                          console.log("Geography Clicked:", displayName, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureData);
                          setSelectedFeatureInfo({
                            feature: featureData,
                            pageX: event.pageX,
                            pageY: event.pageY,
                          });
                        }}
                        className={cn(
                          "stroke-gray-400 dark:stroke-gray-500 stroke-[0.5px] outline-none transition-all duration-150 ease-in-out cursor-pointer",
                          isSelected
                              ? "fill-accent/70 dark:fill-accent/60 stroke-accent-foreground/70 dark:stroke-white/70 stroke-[1.5px]"
                              : "fill-white dark:fill-gray-700 hover:fill-gray-200 dark:hover:fill-gray-600"
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
                    y={-8}
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

