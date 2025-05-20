
"use client";

import type { LegacyRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, type DocumentData } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, InfoIcon, XIcon } from 'lucide-react';
import { feature } from 'topojson-client';
import type { Topology, Objects, GeometryCollection } from 'topojson-specification';

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // This MUST match the layer name in your TopoJSON file

interface SelectedFeatureDisplayInfo {
  feature: ProvinceMapData | CityMapData;
  pageX: number;
  pageY: number;
}

export function HomepageMap() {
  const [mapData, setMapData] = useState<Topology | null>(null);
  const [provinceDetails, setProvinceDetails] = useState<Record<string, ProvinceMapData>>({});
  const [cityDetails, setCityDetails] = useState<Record<string, CityMapData>>({});
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const majorCities: CityMapData[] = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', link: '/districts?name=Kathmandu', population: 1442271, description: "The vibrant capital city, rich in ancient culture and bustling markets." },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', link: '/districts?name=Kaski', population: 400000, description: "A picturesque city nestled by Phewa Lake, offering stunning Himalayan views." },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', link: '/districts?name=Rupandehi', population: 70000, description: "The sacred birthplace of Lord Buddha, a major pilgrimage site." },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      console.log("HomepageMap: Starting data fetch...");
      try {
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const rawMapData: Topology = await geoRes.json();
        console.log("HomepageMap: Raw map data fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 500) + "...");

        if (!rawMapData || typeof rawMapData.objects !== 'object' || !rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
            const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
            console.error("HomepageMap:", errorMsg);
            setFetchError(errorMsg);
            setMapData(null);
            setIsLoading(false);
            return;
        }
        setMapData(rawMapData);

        const provincesSnapshot = await getDocs(collection(db, "nepal_provinces_data"));
        const details: Record<string, ProvinceMapData> = {};
        provincesSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as ProvinceMapData;
          const key = (data.id || data.name || docSnap.id).toLowerCase().replace(/\s+/g, '_');
          details[key] = { ...data, id: docSnap.id, type: 'Province' };
        });
        setProvinceDetails(details);
        console.log("HomepageMap: Province details fetched:", details);

        const cityDetailsData: Record<string, CityMapData> = {};
        for (const city of majorCities) {
            const cityDocRef = doc(db, "nepal_major_cities_data", city.id);
            const cityDocSnap = await getDoc(cityDocRef);
            if (cityDocSnap.exists()) {
                cityDetailsData[city.id] = { ...city, ...cityDocSnap.data(), id: city.id, type: 'City' } as CityMapData;
            } else {
                cityDetailsData[city.id] = {...city, type: 'City'};
            }
        }
        setCityDetails(cityDetailsData);
        console.log("HomepageMap: City details fetched/merged:", cityDetailsData);

      } catch (err) {
        console.error("HomepageMap: Error during data fetching process:", err);
        let specificError = "An unknown error occurred while fetching map data.";
        if (err instanceof Error) {
          specificError = err.message;
        }
        if (specificError.includes("offline") || specificError.includes("Failed to get document") || specificError.includes("firestore/unavailable")) {
            specificError = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${specificError}`;
        } else if (specificError.includes(NEPAL_GEO_URL) && (specificError.includes("404") || specificError.includes("Not Found"))) {
             specificError = `Map geometry file (${NEPAL_GEO_URL}) not found. Ensure it's in the public/data directory and the path is correct.`;
        } else if (specificError.includes("Invalid map data structure") || specificError.includes(TOPOJSON_OBJECT_KEY) || (fetchError && fetchError.includes("objects") && fetchError.includes(TOPOJSON_OBJECT_KEY))) {
             specificError = `The map data file (${NEPAL_GEO_URL}) has an invalid structure or the expected layer ('${TOPOJSON_OBJECT_KEY}') is missing/malformed. Please verify the TopoJSON file.`;
        }
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoading(false);
        console.log("HomepageMap: Data fetching finished.");
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  const handleFeatureClick = (
    featureData: ProvinceMapData | CityMapData,
    event: React.MouseEvent<SVGElement | SVGGElement>
  ) => {
    event.stopPropagation();
    console.log("Feature Clicked:", featureData.name, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureData);
    setSelectedFeatureInfo({
      feature: featureData,
      pageX: event.pageX,
      pageY: event.pageY,
    });
  };

  const closeInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    console.log("Info box closed");
  }, []);

  if (isLoading) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/30 dark:bg-muted/50 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map...</p>
      </div>
    );
  }

  if (fetchError || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", fetchError, "mapData valid:", !!mapData);
    let displayError = fetchError || "Map data could not be loaded. Please try again later.";
    if (displayError.includes("offline") || displayError.includes("Failed to get document")) {
        displayError = "Could not connect to map data service. Please check your Firebase configuration (ensure NEXT_PUBLIC_FIREBASE_... variables are set in .env.local or deployment environment) and internet connection.";
    } else if (displayError.includes("Invalid map data structure") || displayError.includes(TOPOJSON_OBJECT_KEY)) {
        displayError = `The map data file (${NEPAL_GEO_URL}) has an invalid structure or the expected layer ('${TOPOJSON_OBJECT_KEY}') is missing. Please verify the TopoJSON file.`;
    }

    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayError}</p>
      </div>
    );
  }

  if (!mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY]) {
      console.error(`HomepageMap: Critical error - TopoJSON 'objects' property or the specified layer key '${TOPOJSON_OBJECT_KEY}' is missing. Loaded mapData.objects:`, mapData.objects);
      return (
          <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
              <InfoIcon className="h-10 w-10 mb-2" />
              <p className="font-semibold text-lg mb-1">Map Layer Error</p>
              <p className="text-sm">The TopoJSON file is missing the expected layer named &quot;{TOPOJSON_OBJECT_KEY}&quot; or its structure is invalid. Check the file at {NEPAL_GEO_URL}.</p>
          </div>
      );
  }

  const geoObjectLayer = mapData.objects[TOPOJSON_OBJECT_KEY] as GeometryCollection | ExtendedFeature;
  if (!geoObjectLayer || (geoObjectLayer.type === "GeometryCollection" && (typeof geoObjectLayer.geometries === 'undefined' || !Array.isArray(geoObjectLayer.geometries)))) {
    console.error(`HomepageMap: Critical error - The layer object for key '${TOPOJSON_OBJECT_KEY}' does not contain a 'geometries' array or is not a valid GeometryCollection. Layer content:`, geoObjectLayer);
    return (
        <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
            <InfoIcon className="h-10 w-10 mb-2" />
            <p className="font-semibold text-lg mb-1">Map Layer Geometry Error</p>
            <p className="text-sm">The layer &quot;{TOPOJSON_OBJECT_KEY}&quot; in your TopoJSON file is not a valid GeometryCollection or is missing geometries.</p>
        </div>
    );
  }


  return (
    <div
      ref={mapContainerRef}
      className="relative w-full aspect-[16/9] bg-green-100 dark:bg-green-900/20 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={closeInfoBox}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 2800,
          center: [84.1240, 28.3949]
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing provinces and major cities"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
          <Geographies
            geography={mapData}
            parseGeographies={data => {
                const layer = data.objects[TOPOJSON_OBJECT_KEY];
                if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                    return layer.geometries;
                }
                console.warn(`parseGeographies: Layer for key "${TOPOJSON_OBJECT_KEY}" is not a GeometryCollection. Returning empty array. Layer:`, layer);
                return [];
              }}
          >
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ProvinceMapData;
                const geoId = geo.rsmKey || properties?.id?.toString() || properties?.name?.toLowerCase().replace(/\s+/g, '_') || String(Math.random());
                const provinceName = properties?.name || properties?.ADM1_EN || "Unknown Province";
                const detailsFromState = provinceDetails[provinceName.toLowerCase().replace(/\s+/g, '_')] ||
                                         provinceDetails[geoId.toLowerCase().replace(/\s+/g, '_')] ||
                                         {name: provinceName, type: 'Province', link: `/districts?name=${encodeURIComponent(provinceName)}`, id: geoId, description: `Explore ${provinceName}.`};

                const isSelected = selectedFeatureInfo?.feature.id === detailsFromState.id && selectedFeatureInfo.feature.type === 'Province';

                return (
                  <Geography
                    key={geoId}
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(detailsFromState, event)}
                    className={
                      `transition-colors duration-150 ease-out cursor-pointer
                       ${isSelected ? 'fill-accent/70 dark:fill-accent/50 stroke-accent-foreground dark:stroke-accent-foreground/70 stroke-[1px]'
                                  : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30'}`
                    }
                    aria-label={provinceName}
                  />
                );
              })
            }
          </Geographies>

          <Geographies
             geography={mapData}
             parseGeographies={data => {
                const layer = data.objects[TOPOJSON_OBJECT_KEY];
                if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                    return layer.geometries;
                }
                return [];
              }}
          >
            {({ geographies }) =>
                geographies.map(geo => {
                    const properties = geo.properties as ProvinceMapData;
                    const provinceName = properties?.name || properties?.ADM1_EN || "Province";
                    const centroid = (geo as any).centroid as [number, number] | undefined;
                    if (!centroid) return null;

                    let fontSize = 6;
                     if (["Bagmati Province", "Gandaki Province", "Lumbini Province", "Koshi Province"].includes(provinceName)) {
                         fontSize = provinceName === "Bagmati Province" ? 8 : 7;
                     }

                    return (
                        <Marker key={`label-${geo.rsmKey || provinceName}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={0}
                                fontSize={fontSize}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground/80 dark:fill-foreground/60 font-medium pointer-events-none select-none"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                            >
                                {provinceName}
                            </text>
                        </Marker>
                    );
                })
            }
          </Geographies>

          {majorCities.map((city) => {
            const cityInfoFromState = cityDetails[city.id] || city;
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo?.feature.type === 'City';
            let fontSize = 5;
            let circleRadius = 2.5;
            if (["Kathmandu", "Pokhara", "Lumbini"].includes(city.name)) {
                fontSize = city.name === "Kathmandu" ? 9 : 7;
                circleRadius = city.name === "Kathmandu" ? 3.5 : 3;
            }
             if (isSelected) {
                circleRadius = circleRadius * 1.2;
             }

            return (
              <Marker key={city.id} coordinates={city.coordinates} onClick={(event) => handleFeatureClick(cityInfoFromState, event)}>
                 <g
                  className={`cursor-pointer transition-all duration-150 ease-out
                  ${isSelected ? 'fill-accent stroke-accent-foreground'
                               : 'fill-primary stroke-primary-foreground hover:fill-accent hover:stroke-accent-foreground'}`}
                >
                  <circle r={circleRadius} />
                </g>
                <text
                  textAnchor="middle"
                  y={- (circleRadius + 4) }
                  fontSize={fontSize}
                  className={`select-none pointer-events-none transition-opacity duration-150
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/80 dark:fill-foreground/60 hover:opacity-100'}`}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                >
                  {city.name}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

    {selectedFeatureInfo && (
        <Card
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border z-[1000] bg-card text-card-foreground rounded-lg"
            style={{
                left: `${selectedFeatureInfo.pageX + 15}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.offsetWidth - 300 // approx card width + offset
                                ? 'translateX(calc(-100% - 30px))'
                                : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-lg font-bold leading-none flex items-center text-primary">
                        <MapPin className="w-5 h-5 mr-2 flex-shrink-0 text-primary" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                    {selectedFeatureInfo.feature.type && <CardDescription className="text-xs text-muted-foreground pt-0.5 pl-7">{selectedFeatureInfo.feature.type}</CardDescription>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" onClick={closeInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
            {(selectedFeatureInfo.feature.description || selectedFeatureInfo.feature.population) && (
                <CardContent className="p-3 text-sm space-y-1.5">
                {selectedFeatureInfo.feature.population && (
                    <p className="text-muted-foreground">
                    <span className="font-medium text-foreground/90">Population:</span> {Number(selectedFeatureInfo.feature.population).toLocaleString()}
                    </p>
                )}
                {selectedFeatureInfo.feature.description && (
                    <p className="text-muted-foreground line-clamp-3">
                    {selectedFeatureInfo.feature.description}
                    </p>
                )}
                </CardContent>
            )}
            {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 border-t pt-2.5">
                <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-sm text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground"
                onClick={() => {
                    if(selectedFeatureInfo.feature.link) router.push(selectedFeatureInfo.feature.link);
                    closeInfoBox();
                }}
                >
                Learn More <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Button>
            </CardFooter>
            )}
        </Card>
    )}
    </div>
  );
}
