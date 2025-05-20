
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
  type GeographyObject,
} from 'react-simple-maps';
import { cn } from "@/lib/utils";

// Path to your GeoJSON Feature Collection or array of features.
// Assuming this file contains either:
// 1. A GeoJSON FeatureCollection: { "type": "FeatureCollection", "features": [...] }
// 2. An array of GeoJSON Features: [{ "type": "Feature", ... }, ...]
const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Ensure this file is in public/data/

// Combined type for selected feature information
type SelectedFeatureInfo = {
  feature: ExtendedFeature | ExtendedCityMapData; // Can be a province feature or a city
  pageX: number;
  pageY: number;
} | null;


export function HomepageMap() {
  const [selectedFeatureInfo, setSelectedFeatureInfo] = React.useState<SelectedFeatureInfo>(null);
  const [mapData, setMapData] = React.useState<ExtendedFeature[] | null>(null); // Expecting an array of GeoJSON features
  const [provinceDetails, setProvinceDetails] = React.useState<Record<string, ProvinceFeatureProperties>>({});
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
        // 1. Fetch and Parse GeoJSON for province boundaries
        const geoRes = await fetch(NEPAL_GEO_URL);
        console.log("HomepageMap: GeoJSON fetch response status:", geoRes.status);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const jsonData: any = await geoRes.json();
        console.log("HomepageMap: Raw GeoJSON data fetched successfully. Parsed data type:", typeof jsonData, "Is Array:", Array.isArray(jsonData));

        if (jsonData && jsonData.type === "FeatureCollection" && Array.isArray(jsonData.features)) {
          console.log("HomepageMap: Data is a FeatureCollection. Extracting features.");
          setMapData(jsonData.features as ExtendedFeature[]);
        } else if (Array.isArray(jsonData)) {
          console.log("HomepageMap: Data is an array of features.");
          setMapData(jsonData as ExtendedFeature[]);
        } else {
          const errorMsg = `Invalid GeoJSON data structure in ${NEPAL_GEO_URL}. Expected FeatureCollection or array of Features. Received: ${JSON.stringify(jsonData).substring(0,100)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }

        // 2. Firestore Integration: Fetch province details
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, ProvinceFeatureProperties> = {};
        provincesSnapshot.forEach((doc) => {
          const data = doc.data() as ProvinceFeatureProperties; // Assume doc.data() matches ProvinceFeatureProperties
          // Use a consistent ID, e.g., lowercase name or a specific ID field from properties
          const id = data.name?.toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '') || doc.id;
          provData[id] = { ...data, name: data.name || doc.id };
        });
        setProvinceDetails(provData);
        console.log("HomepageMap: Province details fetched from Firestore:", provData);

        // 3. Firestore Integration: Fetch city details
        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityData: Record<string, ExtendedCityMapData> = {};
        citiesSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<ExtendedCityMapData, 'id'>;
           // Use a consistent ID, e.g., lowercase name or a specific ID field
          const id = data.name?.toLowerCase().replace(/\s+/g, '_') || doc.id;
          cityData[id] = {
            id: doc.id,
            name: data.name || doc.id,
            type: "City", // Ensure type is set
            coordinates: data.coordinates || [0,0], // Default if missing
            population: data.population,
            description: data.description,
            link: data.link,
            highlight: data.highlight,
          };
        });
        setCityDetails(cityData);
        console.log("HomepageMap: City details fetched from Firestore:", cityData);

      } catch (error) {
        console.error("HomepageMap: Error during data fetching", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching map data.";
        setFetchError(errorMessage);
        setMapData(null);
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: Data fetching finished. isLoading:", false);
      }
    };

    fetchData();
  }, []);
  
  React.useEffect(() => {
    // This log helps confirm if the state is being updated correctly after a click.
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  const handleFeatureClick = (
    event: React.MouseEvent<SVGPathElement> | React.MouseEvent<SVGGElement>, 
    featureData: ExtendedFeature | ExtendedCityMapData
  ) => {
    event.stopPropagation(); // Prevent map click from closing it immediately
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

  const majorCities: ExtendedCityMapData[] = React.useMemo(() => [
    cityDetails["kathmandu"] || { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], type: "City", description: "Capital city", link: "/districts?name=Kathmandu", highlight: true },
    cityDetails["pokhara"] || { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], type: "City", description: "City of lakes", link: "/districts?name=Kaski", highlight: true },
    cityDetails["lumbini"] || { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], type: "City", description: "Birthplace of Buddha", link: "/districts?name=Rupandehi", highlight: true },
  ], [cityDetails]);


  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/30 rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Loading Interactive Map of Nepal...</p>
      </div>
    );
  }

  if (fetchError || !mapData || mapData.length === 0) {
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">{fetchError || "Could not load map geometries. Ensure GeoJSON file is valid and accessible at " + NEPAL_GEO_URL + ", and Firestore data is available."}.</p>
      </div>
    );
  }
  
  console.log("HomepageMap: Rendering ComposableMap with mapData:", mapData ? `${mapData.length} features` : "null");

  return (
    <>
       {/* Top-level Debug State Indicator - REMOVE AFTER DEBUGGING INFO BOX */}
       <div className="fixed top-2 left-2 bg-yellow-300 text-black p-1 z-[100000] text-xs">
        Debug Info: Selected: {selectedFeatureInfo?.feature?.name || 'None'} at X:{selectedFeatureInfo?.pageX} Y:{selectedFeatureInfo?.pageY}
      </div>

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
            "transition-all duration-200 ease-out opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
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
            <Geographies geography={mapData as GeographyObject[]}> 
              {({ geographies }) =>
                geographies.map((geo: ExtendedFeature | GeographyObject) => {
                  const currentGeo = geo as ExtendedFeature; // Cast to access properties
                  const isSelected = selectedFeatureInfo?.feature.type === "Province" && selectedFeatureInfo?.feature.id === (currentGeo.id || currentGeo.properties?.id || currentGeo.rsmKey);
                  
                  const provinceName = currentGeo.properties?.name || currentGeo.properties?.ADM1_EN || currentGeo.properties?.DIST_EN || `Region ${currentGeo.rsmKey?.slice(-4) || 'Unknown'}`;
                  const provinceFirestoreId = provinceName.toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '');
                  const details = provinceDetails[provinceFirestoreId] || {};

                  const featureDataForClick: ExtendedFeature = {
                    // Construct the feature data needed for the info box
                    type: "Feature", // Or determine more accurately if possible
                    id: currentGeo.id || currentGeo.properties?.id || currentGeo.rsmKey,
                    properties: { // This needs to align with what your info box expects.
                      name: provinceName,
                      ADM1_EN: provinceName, // Assuming name is the admin level 1 name
                      link: details.link || `/districts?name=${encodeURIComponent(provinceName)}`,
                      description: details.description,
                      population: details.population,
                      // ... any other properties from 'geo.properties' or 'details'
                      ...currentGeo.properties
                    },
                    geometry: currentGeo.geometry // This is already a GeoJSON geometry
                  };

                  return (
                    <Geography
                      key={currentGeo.rsmKey || currentGeo.id || currentGeo.properties?.id || `geo-${provinceName}`}
                      geography={currentGeo as GeographyObject}
                      onClick={(event) => handleFeatureClick(event as any, featureDataForClick)}
                      className={cn(
                        "outline-none transition-all duration-150 ease-in-out cursor-pointer",
                        isSelected
                          ? "fill-accent/70 dark:fill-accent/60 stroke-accent-foreground/70 dark:stroke-white/70 stroke-[1.2px]"
                          : "fill-card dark:fill-gray-700 hover:fill-accent/40 dark:hover:fill-accent/30 stroke-border dark:stroke-gray-500 stroke-[0.5px]"
                      )}
                    />
                  );
                })
              }
            </Geographies>
            <Geographies geography={mapData as GeographyObject[]}>
              {({ geographies }) =>
                geographies.map((geo: ExtendedFeature | GeographyObject) => {
                  const currentGeo = geo as ExtendedFeature;
                  const properties = currentGeo.properties as ProvinceFeatureProperties;
                  const centroid = (currentGeo as any).centroid as [number, number] | undefined; // react-simple-maps adds this
                  let displayName = properties?.name || properties?.ADM1_EN || properties?.DIST_EN || '';

                  if (!centroid || !displayName) return null;
                  
                  // Simple filter to declutter labels for major provinces
                  const showLabelFor = ["Bagmati", "Gandaki", "Lumbini", "Koshi", "Sudurpashchim", "Karnali", "Madhesh"]; 
                  const isMajorProvince = showLabelFor.some(pName => displayName.includes(pName));
                  const isKathmandu = displayName.toLowerCase().includes("kathmandu");

                  if (!isMajorProvince && !isKathmandu) {
                     // return null; // Uncomment to filter labels
                  }

                  return (
                    <Marker key={`label-${currentGeo.rsmKey || currentGeo.id || displayName}`} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        y={-2} 
                        className="fill-foreground dark:fill-gray-200 pointer-events-none select-none"
                        style={{ 
                            fontSize: isKathmandu ? "8px" : "6px", 
                            fontWeight: 500, 
                            paintOrder: "stroke", 
                            stroke: "hsl(var(--background))", 
                            strokeWidth: "0.5px", 
                            strokeLinecap: "butt", 
                            strokeLinejoin: "miter" 
                        }}
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
                  onClick={(event) => handleFeatureClick(event as any, city)}
                >
                   <g transform="translate(-6, -12)"> {/* Offset to center the pin point */}
                    <MapPin
                      className={cn(
                        "transition-all duration-150 ease-in-out cursor-pointer",
                        isSelected 
                          ? "text-accent dark:text-accent" 
                          : "text-primary hover:text-accent/70 dark:hover:text-accent/60",
                        city.highlight ? "w-5 h-5 md:w-6 md:h-6" : "w-4 h-4 md:w-5 md:h-5"
                      )}
                      fill={isSelected ? "hsl(var(--accent))" : (city.highlight ? "hsl(var(--primary))" : "hsl(var(--primary)/0.7)")}
                      strokeWidth={1.5}
                      stroke="hsl(var(--background))"
                    />
                  </g>
                  <text
                    textAnchor="middle"
                    y={city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini" ? -20 : -15}
                    className={cn(
                      "fill-foreground dark:fill-gray-200 pointer-events-none select-none font-semibold",
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
          Map data &copy; Nepal. Boundaries indicative.
        </div>
      </div>
    </>
  );
}
