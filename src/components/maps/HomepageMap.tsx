
"use client";

import type { ExtendedFeature, ExtendedProvinceMapData, ExtendedCityMapData } from '@/types';
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
import { feature as topojsonFeature, type Topology } from 'topojson-client';
import { cn } from "@/lib/utils";

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // This should be a TopoJSON file
const TOPOJSON_OBJECT_KEY = "nepal"; // The key of the object layer in your TopoJSON file that contains province/district geometries

interface SelectedFeatureInfo {
  feature: ExtendedProvinceMapData | ExtendedCityMapData;
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [selectedFeatureInfo, setSelectedFeatureInfo] = React.useState<SelectedFeatureInfo | null>(null);
  const [mapData, setMapData] = React.useState<ExtendedFeature[] | null>(null); // Will store an array of GeoJSON features
  const [provinceDetails, setProvinceDetails] = React.useState<Record<string, ExtendedProvinceMapData>>({});
  const [cityDetails, setCityDetails] = React.useState<Record<string, ExtendedCityMapData>>({});
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
      console.log("HomepageMap: Starting data fetch...");

      try {
        // Fetch TopoJSON
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0, 200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
        const rawMapData: Topology = await geoRes.json(); // Expect TopoJSON
        console.log("HomepageMap: Raw TopoJSON fetched. Keys in objects:", Object.keys(rawMapData.objects || {}));

        if (rawMapData && typeof rawMapData.objects === 'object' && rawMapData.objects !== null && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          // Ensure the layer is a valid GeometryCollection or a single Geometry that topojson-client can process
          if ((layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) || ["Polygon", "MultiPolygon"].includes(layer.type)) {
            // Convert TopoJSON layer to GeoJSON features
            const geoJsonFeatures = topojsonFeature(rawMapData, layer).features as ExtendedFeature[];
            setMapData(geoJsonFeatures);
            console.log(`HomepageMap: TopoJSON layer "${TOPOJSON_OBJECT_KEY}" successfully converted to ${geoJsonFeatures.length} GeoJSON features.`);
          } else {
            const errorMsg = `Invalid TopoJSON structure: Layer "${TOPOJSON_OBJECT_KEY}" is not a GeometryCollection with a 'geometries' array or a recognized single geometry. Found type: ${layer.type}`;
            console.error("HomepageMap:", errorMsg, layer);
            throw new Error(errorMsg);
          }
        } else {
          const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }

        // Fetch province details from Firestore
        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const provData: Record<string, ExtendedProvinceMapData> = {};
        provincesSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<ExtendedProvinceMapData, 'id' | 'type'>;
          // Use a consistent key, e.g., lowercase name or specific ID from properties
          const id = (data.name || doc.id).toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '');
          provData[id] = {
            id: doc.id,
            type: "Province",
            name: data.name || doc.id,
            population: data.population,
            description: data.description,
            link: data.link || `/districts?name=${encodeURIComponent(data.name || doc.id)}`
          };
        });
        setProvinceDetails(provData);
        console.log("HomepageMap: Province details fetched:", Object.keys(provData).length, "provinces");

        // Fetch city details from Firestore
        const citiesSnapshot = await getDocs(collection(db, "nepal_major_cities_data"));
        const cityData: Record<string, ExtendedCityMapData> = {};
        citiesSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<ExtendedCityMapData, 'id' | 'type'>;
          const id = (data.name || doc.id).toLowerCase().replace(/\s+/g, '_');
          cityData[id] = {
            id: doc.id,
            name: data.name || doc.id,
            type: "City",
            coordinates: data.coordinates || [0,0],
            population: data.population,
            description: data.description,
            link: data.link || `/districts?name=${encodeURIComponent(data.name || doc.id)}`,
            highlight: data.highlight,
          };
        });
        setCityDetails(cityData);
        console.log("HomepageMap: City details fetched:", Object.keys(cityData).length, "cities");

      } catch (error) {
        console.error("HomepageMap: Error during data fetching", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching map data.";
        if (errorMessage.includes("offline") || errorMessage.includes("firestore")) {
          setFetchError(`Data Connection Error: Could not connect to update map details. (Details: ${errorMessage})`);
        } else if (errorMessage.includes("404")) {
            setFetchError(`Map File Not Found: Could not load map data from ${NEPAL_GEO_URL}. Ensure the file exists in /public/data/ and is correctly named.`);
        } else {
            setFetchError(errorMessage);
        }
        setMapData(null);
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: Data fetching finished. isLoading:", false);
      }
    };
    fetchData();
  }, []);


  const majorCities: ExtendedCityMapData[] = React.useMemo(() => {
    return [
        cityDetails["kathmandu"] || { id: "kathmandu", name: "Kathmandu", coordinates: [85.3240, 27.7172], type: "City", description: "Capital city, rich in culture and history.", link: "/districts?name=Kathmandu", highlight: true, population: 1442271 },
        cityDetails["pokhara"] || { id: "pokhara", name: "Pokhara", coordinates: [83.9856, 28.2096], type: "City", description: "City of lakes, gateway to Annapurna.", link: "/districts?name=Kaski", highlight: true, population: 400000 },
        cityDetails["lumbini"] || { id: "lumbini", name: "Lumbini", coordinates: [83.2756, 27.4816], type: "City", description: "Birthplace of Lord Buddha.", link: "/districts?name=Rupandehi", highlight: true, population: 70000 },
    ].filter(city => city.name && city.coordinates && city.coordinates.length === 2) as ExtendedCityMapData[];
  }, [cityDetails]);

  const handleMapContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the click is on the map container itself, not on interactive elements
    if (event.target === mapContainerRef.current) {
        console.log("Map container clicked, closing info box.");
        setSelectedFeatureInfo(null);
    }
  };


  // Pre-render checks
  if (fetchError) {
    return (
      <div className="aspect-[16/9] w-full bg-destructive/10 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-destructive dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Data Error</p>
        <p className="text-xs">{fetchError}</p>
      </div>
    );
  }

  if (isLoading || !mapData) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/30 rounded-lg flex items-center justify-center">
        <Skeleton className="h-full w-full" />
        <p className="absolute text-primary font-semibold">Loading Interactive Map of Nepal...</p>
      </div>
    );
  }
   if (!Array.isArray(mapData) || mapData.length === 0) {
    console.error("HomepageMap: mapData is not a valid array of features or is empty after processing.", mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
        <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold mb-1 text-lg">Map Display Error</p>
        <p className="text-xs">Processed map data is invalid or empty. Check TopoJSON file and console logs.</p>
      </div>
    );
  }

  return (
    <>
      {selectedFeatureInfo && (
        <Card
          style={{
            position: 'fixed',
            left: `${selectedFeatureInfo.pageX + 15}px`,
            top: `${selectedFeatureInfo.pageY + 15}px`,
            transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.clientWidth - 270 // Card width approx 256px + offset
                ? 'translateX(calc(-100% - 30px))'
                : 'translateX(0)',
          }}
          className={cn(
            "p-0 w-64 shadow-xl border-border z-[60] rounded-md bg-card text-card-foreground",
            "transition-all duration-200 ease-out"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="flex flex-row items-center justify-between p-3 border-b bg-muted/50">
            <CardTitle className="text-base font-semibold text-primary flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary/80" />
              {selectedFeatureInfo.feature.name}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedFeatureInfo(null)} aria-label="Close info box">
              <XIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
          </CardHeader>
          {selectedFeatureInfo.feature.description && (
             <CardContent className="p-3 text-xs text-muted-foreground">
                <p className="line-clamp-3">{selectedFeatureInfo.feature.description}</p>
                 {selectedFeatureInfo.feature.population && (
                    <p className="mt-1.5">Population: {selectedFeatureInfo.feature.population.toLocaleString()}</p>
                 )}
             </CardContent>
          )}
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
        onClick={handleMapContainerClick}
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 4500, // Adjusted scale
            center: [84.1240, 28.3949] // Center of Nepal
          }}
          style={{ width: "100%", height: "100%" }}
          aria-label="Interactive map of Nepal showing provinces and key cities"
        >
          <ZoomableGroup center={[84.1240, 28.3949]} zoom={1} minZoom={0.7} maxZoom={10}>
            <Geographies 
              geography={mapData} // mapData is now an array of GeoJSON features
            >
              {({ geographies }) =>
                geographies.map(geo => {
                  const currentProperties = geo.properties as ExtendedProvinceMapData;
                  const geoId = currentProperties?.id || geo.rsmKey || `geo-${Math.random()}`;
                  
                  // Match with Firestore data using a derived key or property from GeoJSON
                  const firestoreKey = (currentProperties?.name || geoId).toLowerCase().replace(/\s+/g, '_').replace(/_province$/, '');
                  const details: ExtendedProvinceMapData = provinceDetails[firestoreKey] || {
                    id: geoId,
                    name: currentProperties?.name || `Region`,
                    type: "Province",
                    link: `/districts?name=${encodeURIComponent(currentProperties?.name || `Region`)}`
                  };
                  
                  const displayName = details.name;
                  const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo?.feature.type === "Province";

                  const featureDataForClick: ExtendedProvinceMapData = {
                    id: geoId,
                    name: displayName,
                    type: "Province",
                    population: details.population,
                    description: details.description,
                    link: details.link,
                  };

                  return (
                    <Geography
                      key={geoId}
                      geography={geo}
                      onClick={(event: React.MouseEvent<SVGPathElement>) => {
                        event.stopPropagation();
                        console.log("Geography Clicked:", displayName, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureDataForClick);
                        setSelectedFeatureInfo({
                          feature: featureDataForClick,
                          pageX: event.pageX,
                          pageY: event.pageY,
                        });
                      }}
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
            <Geographies 
                geography={mapData} // mapData is already an array of GeoJSON features
            >
              {({ geographies }) =>
                geographies.map((geo: ExtendedFeature) => { 
                  const properties = geo.properties;
                  const centroid = (geo as any).centroid as [number, number] | undefined; // react-simple-maps might add centroid
                  let displayName = properties?.name || `Region ${geo.id?.toString().slice(-4) || 'Unknown'}`;
                 
                  if (!centroid || !displayName) return null;
                  
                  const showLabelFor = ["Bagmati Province", "Gandaki Province", "Lumbini Province", "Koshi Province", "Sudurpashchim Province", "Karnali Province", "Madhesh Province"]; 
                  const isMajorProvince = showLabelFor.some(pName => displayName.includes(pName));
                 
                  if (!isMajorProvince && displayName !== "Kathmandu" && displayName !== "Pokhara" && displayName !== "Lumbini") return null;

                  return (
                    <Marker key={`label-${geo.id || displayName}`} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        y={-2} 
                        className="fill-foreground dark:fill-gray-200 pointer-events-none select-none"
                        style={{ 
                            fontSize: (displayName === "Kathmandu" || displayName === "Pokhara" || displayName === "Lumbini") ? "9px" : "6px", 
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
               const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo?.feature.type === "City";
               const featureDataForClick = { ...city, type: "City" as "City" };

               return (
                <Marker
                  key={city.id}
                  coordinates={city.coordinates}
                  onClick={(event: React.MouseEvent<SVGGElement>) => {
                    event.stopPropagation();
                    console.log("City marker clicked:", city.name, "Event pageX:", event.pageX, "pageY:", event.pageY);
                    setSelectedFeatureInfo({
                      feature: featureDataForClick,
                      pageX: event.pageX,
                      pageY: event.pageY,
                    });
                  }}
                >
                  <g transform="translate(-6, -12)"> {/* Centering adjustment for MapPin */}
                    <MapPin
                      className={cn(
                        "h-4 w-4 transition-all duration-150 ease-in-out cursor-pointer",
                        isSelected || selectedFeatureInfo?.feature.id === city.id // Keep selected style if info box is open
                          ? "text-accent dark:text-accent drop-shadow-lg scale-110" 
                          : "text-primary dark:text-primary-foreground/80 hover:text-accent/80 dark:hover:text-accent/70",
                      )}
                    />
                  </g>
                  <text
                    textAnchor="middle"
                    y={ (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") ? -14 : -10 } // Adjusted Y for text above pin
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
          Map data &copy; Nepal. Boundaries indicative. Click to explore.
        </div>
      </div>
    </>
  );
}
