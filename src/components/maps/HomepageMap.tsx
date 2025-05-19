
"use client";

import type { GeoJSON as LocalGeoJSON, ProvinceFeatureProperties } from '@/types'; // Assuming ProvinceFeatureProperties is defined
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { InfoIcon, ExternalLink, XIcon, MapPin, Users } from 'lucide-react'; // Added Users icon
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

// Extended types to include 'type' for distinguishing features
interface ExtendedProvinceMapData {
  id: string;
  name: string;
  type: "Province";
  population?: number;
  description?: string;
  link?: string;
  properties: ProvinceFeatureProperties; // Original properties from GeoJSON
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
  properties: any; // City properties if any, can be an empty object
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
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) throw new Error(`Failed to fetch TopoJSON from ${NEPAL_GEO_URL}: ${geoRes.statusText} (${geoRes.status})`);
        const topoJsonData: any = await geoRes.json();
        
        console.log("HomepageMap: TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(topoJsonData, null, 2).substring(0, 200) + "...");

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
        const provData: Record<string, Partial<ExtendedProvinceMapData>> = {};
        provincesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          // Normalize ID: lowercase, replace spaces with underscores, remove "_province" suffix
          const normalizedId = (data.id?.toLowerCase() || doc.id.toLowerCase()).replace(/\s+/g, '_').replace(/_province$/, '');
          provData[normalizedId] = { population: data.population, description: data.description, link: data.link };
        });
        setProvinceDetails(provData);

        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityDataColl: Record<string, Partial<ExtendedCityMapData>> = {};
        citiesSnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          cityDataColl[doc.id.toLowerCase()] = { population: data.population, description: data.description, link: data.link };
        });
        setCityDetails(cityDataColl);

      } catch (error) {
        console.error("Error loading map data:", error);
        let errorMsg = error instanceof Error ? error.message : "An unknown error occurred while loading map data.";
        if (errorMsg.includes("offline") || errorMsg.includes("Failed to get document because the client is offline")) {
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
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  const handleMapClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Close info box if clicking on the map container itself
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
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">
          {fetchError || `Could not load or parse map data. Ensure public/data/nepal-provinces-topo.json is correct (valid TopoJSON with an "objects" property containing at least one GeometryCollection with a "geometries" array) and Firebase data is accessible.`}
        </p>
         <p className="text-xs mt-2">
            {fetchError && (fetchError.includes("offline") || fetchError.includes("Failed to get document")) 
                ? "Please check your Firebase configuration and internet connection." 
                : "Verify the TopoJSON file structure in public/data/ and check console logs for more details."}
        </p>
      </div>
    );
  }


  return (
    <div
      ref={mapContainerRef}
      className="relative aspect-[16/9] w-full bg-green-100 dark:bg-green-900/30 rounded-lg shadow-lg overflow-hidden border border-border"
      onClick={handleMapClick} // Handles clicks on the map background to close info box
    >
      {selectedFeatureInfo && selectedFeatureInfo.feature && (
        <Card
          className={cn(
            "fixed p-0 w-64 shadow-xl border rounded-lg z-[60]",
            "bg-card text-card-foreground border-border" // Theme-aware card style
          )}
          style={{
            left: `${selectedFeatureInfo.pageX + 15}px`,
            top: `${selectedFeatureInfo.pageY + 15}px`,
            // Basic adjustment if too close to the right edge of the window (not map container)
            transform: selectedFeatureInfo.pageX > window.innerWidth - 300 ? 'translateX(calc(-100% - 30px))' : 'none',
          }}
          onClick={(e) => e.stopPropagation()} // Prevent map click from closing it
        >
          <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold text-primary flex items-center gap-1.5">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              {selectedFeatureInfo.feature.name}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => setSelectedFeatureInfo(null)} aria-label="Close info box">
                <XIcon className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-3 pt-0 text-xs space-y-1">
            {selectedFeatureInfo.feature.description && (
                <p className="text-muted-foreground line-clamp-3">{selectedFeatureInfo.feature.description}</p>
            )}
             {selectedFeatureInfo.feature.population !== undefined && (
              <p className="text-muted-foreground flex items-center">
                <Users className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                Approx. Pop: {Number(selectedFeatureInfo.feature.population).toLocaleString()}
              </p>
            )}
          </CardContent>
          {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 pt-1 border-t">
                <Button asChild variant="outline" size="sm" className="w-full text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground text-xs h-8">
                  <Link href={selectedFeatureInfo.feature.link} target="_blank" rel="noopener noreferrer">
                    Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Link>
                </Button>
            </CardFooter>
          )}
        </Card>
      )}
      <div className="h-full w-full"> {/* This div is crucial for ComposableMap to take full dimensions */}
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 4500, // Adjust for desired zoom/fit of Nepal
            center: [84.1240, 28.3949] // Center of Nepal
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
                          event.stopPropagation(); // Prevent map click from closing info box immediately
                          const displayName = currentProperties.DIST_EN || currentProperties.ADM1_EN || `Region ${geo.rsmKey.slice(-4)}`;
                          const linkName = currentProperties.DIST_EN ? displayName : (currentProperties.ADM1_EN || displayName);
                          
                          console.log("Geography clicked:", displayName, "Properties:", currentProperties, "Event pageX:", event.pageX, "pageY:", event.pageY);

                          setSelectedFeatureInfo({
                            feature: {
                              id: geo.rsmKey,
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
             {/* Labels for Provinces/Districts */}
             {mapData && provinceObjectKeyRef.current && mapData.objects[provinceObjectKeyRef.current] && (
              <Geographies geography={mapData} object={mapData.objects[provinceObjectKeyRef.current]}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const properties = geo.properties as ProvinceFeatureProperties;
                    // Prioritize district name, then province-level name for display
                    const districtNameProp = properties.DIST_EN || properties.NAME_2 || properties.ADM2_EN; // Common district name properties
                    const provinceLevelNameProp = properties.ADM1_EN || properties.NAME_1; // Common province name properties
                    const displayName = districtNameProp || provinceLevelNameProp;

                    const centroid = (geo as any).centroid as [number, number] | undefined; // react-simple-maps often adds centroid

                    // Basic filtering for less clutter, you might want a more sophisticated labeling strategy
                    const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi", "Sudurpashchim", "Madhesh", "Karnali", "Kathmandu", "Pokhara", "Lumbini"];
                    if (!centroid || !displayName || (provinceLevelNameProp && !showLabelFor.some(p => provinceLevelNameProp.includes(p))) ) return null;
                    if (districtNameProp && !showLabelFor.some(p => districtNameProp.includes(p)) ) return null;


                    let fontSizeClass = "text-[5px] md:text-[7px]";
                    if (displayName && ["Kathmandu", "Pokhara", "Lumbini"].includes(displayName) || (provinceLevelNameProp && ["Bagmati", "Gandaki", "Koshi"].includes(provinceLevelNameProp))) {
                        fontSizeClass = "text-[6px] md:text-[8px]";
                    }
                     if (displayName === "Kathmandu" || displayName === "Pokhara" || displayName === "Lumbini") {
                        fontSizeClass = "text-[7px] md:text-[9px]"; // Even larger for key cities/districts
                    }

                    return (
                      <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                        <text
                          textAnchor="middle"
                          y={properties.NAME_1 === "Bagmati" ? 2 : (properties.NAME_1 === "Madhesh" ? -1 : 0)} // Minor y-offset for some labels
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
            {/* Markers for Major Cities */}
            {majorCities.map(city => {
              const cityDetailsForInfo = cityDetails[city.id.toLowerCase()] || {};
              const isSelected = selectedFeatureInfo?.feature.type === "City" && selectedFeatureInfo.feature.id === city.id;

              return (
                <Marker
                  key={city.id}
                  coordinates={city.coordinates}
                  onClick={(event: React.MouseEvent<SVGGElement>) => {
                      event.stopPropagation(); // Prevent map click from closing info box immediately
                      console.log("City marker clicked:", city.name, "Event pageX:", event.pageX, "pageY:", event.pageY);
                      setSelectedFeatureInfo({
                          feature: {
                              ...city, // Spread existing city data
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
                    r={isSelected ? 6 : 4} // Slightly larger when selected
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
                    y={ (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") ? -10 : -8} // Adjusted y for larger font
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
