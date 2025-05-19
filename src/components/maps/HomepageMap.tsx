
"use client";

import type { GeoJSON as LocalGeoJSON, ProvinceMapData, CityMapData as LocalCityMapData, ProvinceFeatureProperties } from '@/types';
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

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Ensure this file exists and is correct

interface ExtendedProvinceMapData extends ProvinceMapData {
  type: "Province";
  properties: ProvinceFeatureProperties;
}

interface ExtendedCityMapData extends LocalCityMapData {
  type: "City";
  properties: ProvinceFeatureProperties; // Or a specific CityFeatureProperties if needed
}

interface SelectedFeatureInfo {
  feature: ExtendedProvinceMapData | ExtendedCityMapData;
  pageX: number;
  pageY: number;
}

const majorCities: ExtendedCityMapData[] = [
  { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], type: "City", description: "Capital city, rich in culture and ancient temples.", link: "/districts?name=Kathmandu", population: 1442271, highlight: true, properties: {} as ProvinceFeatureProperties },
  { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], type: "City", description: "City of lakes, with stunning Himalayan views.", link: "/districts?name=Kaski", population: 400000, highlight: true, properties: {} as ProvinceFeatureProperties },
  { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], type: "City", description: "Birthplace of Lord Buddha, a sacred pilgrimage site.", link: "/districts?name=Rupandehi", population: 100000, highlight: true, properties: {} as ProvinceFeatureProperties },
];

export function HomepageMap() {
  const [selectedFeatureInfo, setSelectedFeatureInfo] = React.useState<SelectedFeatureInfo | null>(null);
  const [mapData, setMapData] = React.useState<any | null>(null);
  const [provinceDetails, setProvinceDetails] = React.useState<Record<string, Partial<ProvinceMapData>>>({});
  const [cityDetails, setCityDetails] = React.useState<Record<string, Partial<LocalCityMapData>>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const provinceObjectKeyRef = React.useRef<string | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) throw new Error(`Failed to fetch TopoJSON from ${NEPAL_GEO_URL}: ${geoRes.statusText} (${geoRes.status})`);
        const topoJsonData: any = await geoRes.json();
        
        console.log("HomepageMap: TopoJSON fetched. Parsed data sample:", JSON.stringify(topoJsonData, null, 2).substring(0, 500));

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

        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, Partial<ProvinceMapData>> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          const normalizedId = (data.id?.toLowerCase() || doc.id.toLowerCase()).replace(/\s+/g, '_').replace(/_province$/, '');
          provData[normalizedId] = { population: data.population, description: data.description, link: data.link };
        });
        setProvinceDetails(provData);

        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityDataColl: Record<string, Partial<LocalCityMapData>> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          cityDataColl[doc.id.toLowerCase()] = { population: data.population, description: data.description, link: data.link };
        });
        setCityDetails(cityDataColl);

      } catch (error) {
        console.error("Error loading map data:", error);
        let errorMsg = error instanceof Error ? error.message : "An unknown error occurred while loading map data.";
        if (errorMsg.includes("offline") || errorMsg.includes("Failed to get document")) {
            errorMsg = `Map data could not be loaded. Please check your internet connection and Firebase setup/configuration. (${errorMsg})`;
        } else if (errorMsg.includes("Invalid TopoJSON")) {
            // Error message is already specific
        } else {
            errorMsg = `Error fetching or parsing map data: ${errorMsg}. Ensure public/data/nepal-provinces-topo.json is correct and Firebase data is accessible.`;
        }
        setFetchError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  React.useEffect(() => {
    if (selectedFeatureInfo) {
        console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
    }
  }, [selectedFeatureInfo]);

  const handleMapClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Close info box if clicking on the map container itself, not on a feature that opens it
    if (event.target === event.currentTarget || (event.target as HTMLElement).closest('.composable-map-container') === event.currentTarget.querySelector('.composable-map-container')) {
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
          {fetchError || `Could not load or parse map data. Ensure public/data/nepal-provinces-topo.json is correct (valid TopoJSON with an "objects" property containing at least one GeometryCollection with a "geometries" array) and Firebase data is accessible.`}
        </p>
         <p className="text-xs mt-2">If the error message contains "offline" or "Failed to get document", please check your Firebase configuration and internet connection. Otherwise, verify the TopoJSON file structure and content in your console logs.</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="relative aspect-[16/9] w-full bg-green-100 dark:bg-green-900/30 rounded-lg shadow-lg overflow-hidden border border-border"
      onClick={handleMapClick}
    >
      {selectedFeatureInfo && selectedFeatureInfo.feature && (
        <>
          {console.log("Rendering info box for:", selectedFeatureInfo.feature.name)}
          <Card
            className="fixed p-0 w-64 shadow-xl border-2 border-yellow-400 bg-red-500 text-white z-[9999] rounded-md" // Highly visible debug style
            style={{
              left: `${selectedFeatureInfo.pageX + 15}px`,
              top: `${selectedFeatureInfo.pageY + 15}px`,
              // Removed transform for simplified debugging
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 bg-red-600 rounded-t-md">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
                <MapPin className="h-4 w-4 flex-shrink-0 text-yellow-300" />
                {selectedFeatureInfo.feature.name}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-yellow-300 hover:text-white" onClick={() => setSelectedFeatureInfo(null)} aria-label="Close info box">
                  <XIcon className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-3 pt-2 text-xs space-y-1">
              <p className="text-gray-200">Type: {selectedFeatureInfo.feature.type}</p>
              {selectedFeatureInfo.feature.population !== undefined && (
                <p className="text-gray-200 flex items-center">
                  <Users className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                  Approx. Pop: {Number(selectedFeatureInfo.feature.population).toLocaleString()}
                </p>
              )}
              {selectedFeatureInfo.feature.description && (
                  <p className="text-gray-200 line-clamp-3">{selectedFeatureInfo.feature.description}</p>
              )}
            </CardContent>
            {selectedFeatureInfo.feature.link && (
              <CardFooter className="p-3 pt-1 border-t border-red-400">
                  <Button asChild variant="outline" size="xs" className="w-full text-yellow-300 border-yellow-400 hover:bg-yellow-500 hover:text-red-700">
                    <Link href={selectedFeatureInfo.feature.link} target="_blank" rel="noopener noreferrer">
                      Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
                    </Link>
                  </Button>
              </CardFooter>
            )}
          </Card>
        </>
      )}
      <div className="composable-map-container h-full w-full">
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

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={(event: React.MouseEvent<SVGPathElement>) => {
                          event.stopPropagation();
                          const detailLookupKey = (currentProperties.DIST_EN || currentProperties.ADM1_EN || '').toLowerCase().replace(/\s+/g, '_').replace(/_province$|_district$/, '');
                          const details = provinceDetails[detailLookupKey] || {};
                          const displayName = currentProperties.DIST_EN || currentProperties.ADM1_EN || `Region ${geo.rsmKey.slice(-4)}`;
                          const linkName = currentProperties.DIST_EN ? displayName : (currentProperties.ADM1_EN || displayName);

                          console.log("Geography clicked:", displayName, "Properties:", currentProperties, "Event pageX:", event.pageX, "pageY:", event.pageY);

                          setSelectedFeatureInfo({
                            feature: {
                              id: geo.rsmKey, // Use rsmKey for unique identification
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
                          "stroke-border dark:stroke-gray-600 stroke-[0.5px] outline-none transition-all duration-150 ease-in-out cursor-pointer",
                          isSelected
                              ? "fill-accent/70 dark:fill-accent/60 stroke-accent-foreground/70 dark:stroke-white/70 stroke-[1.5px]"
                              : "fill-card dark:fill-gray-700 hover:fill-accent/40 dark:hover:fill-accent/50"
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
                    const displayName = districtNameProp || provinceLevelNameProp;

                    const centroid = (geo as any).centroid as [number, number] | undefined;

                    const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi", "Sudurpashchim", "Madhesh", "Karnali", "Kathmandu", "Pokhara", "Lumbini"];
                    if (!centroid || !displayName || (provinceLevelNameProp && !showLabelFor.some(p => provinceLevelNameProp.includes(p))) ) return null;
                    if (districtNameProp && !showLabelFor.some(p => districtNameProp.includes(p)) ) return null;

                    let fontSizeClass = "text-[5px] md:text-[7px]";
                    if (displayName && ["Kathmandu", "Pokhara", "Lumbini"].includes(displayName) || (provinceLevelNameProp && ["Bagmati", "Gandaki", "Koshi"].includes(provinceLevelNameProp))) {
                        fontSizeClass = "text-[6px] md:text-[8px]";
                    }
                     if (displayName === "Kathmandu" || displayName === "Pokhara" || displayName === "Lumbini") {
                        fontSizeClass = "text-[7px] md:text-[9px]"; // Even larger for key cities
                    }


                    return (
                      <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                        <text
                          textAnchor="middle"
                          y={properties.NAME_1 === "Bagmati" ? 2 : (properties.NAME_1 === "Madhesh" ? -1 : 0)}
                          className={cn(fontSizeClass, "fill-foreground pointer-events-none select-none font-medium")}
                          style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.75px", strokeLinecap: "butt", strokeLinejoin: "miter" }}
                        >
                          {displayName.replace(" Province", "").replace(" District", "")}
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
                      console.log("City marker clicked:", city.name, "Event pageX:", event.pageX, "pageY:", event.pageY);
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
                    r={isSelected ? 6 : 4}
                    className={cn(
                      "transition-all duration-150 ease-in-out cursor-pointer",
                      isSelected
                          ? "fill-accent stroke-accent-foreground"
                          : "fill-primary stroke-primary-foreground hover:fill-accent/80 hover:stroke-accent-foreground"
                    )}
                    strokeWidth={0.5}
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
