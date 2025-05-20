
"use client";

import type { LegacyRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, doc, getDoc, type DocumentData } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, InfoIcon, XIcon, LocateFixed } from 'lucide-react';
import { feature } from 'topojson-client';
import type { Topology, Objects, GeometryCollection } from 'topojson-specification';

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; 
const TOPOJSON_OBJECT_KEY = "nepal";

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
        console.log("HomepageMap: Raw TopoJSON data fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 200) + "...");

        if (!rawMapData || typeof rawMapData.objects !== 'object' || !rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
            const errorMsg = `Invalid map data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0, 200)}...`;
            console.error("HomepageMap:", errorMsg);
            setFetchError(errorMsg);
            setMapData(null); // Set mapData to null on critical error
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
                cityDetailsData[city.id] = { ...cityDocSnap.data(), id: city.id, type: 'City' } as CityMapData;
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
        
        if (specificError.includes("offline") || specificError.includes("Failed to get document")) {
            specificError = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${specificError}`;
        } else if (fetchError && fetchError.includes("404") && fetchError.includes(NEPAL_GEO_URL)) {
             specificError = `Could not load map geometry data from ${NEPAL_GEO_URL}. Please ensure the file exists in the public/data directory.`;
        } else if (specificError.includes("objects."+TOPOJSON_OBJECT_KEY) || specificError.includes("geometries") || specificError.includes("Invalid map data structure")) {
             specificError = `The map data file (${NEPAL_GEO_URL}) has an invalid structure or the expected layer '${TOPOJSON_OBJECT_KEY}' is missing/malformed. Please verify the TopoJSON file. Original error: ${specificError}`;
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
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">
          {fetchError ? 
            (fetchError.includes("Firebase") || fetchError.includes("offline") || fetchError.includes("Failed to get document") ? 
              `Could not connect to the map data service. Please check your Firebase configuration (especially environment variables for API keys, project ID, etc. if deployed) and internet connection. Details: ${fetchError}`
              : fetchError.includes(NEPAL_GEO_URL) && fetchError.includes("404") ?
              `Map geometry file (${NEPAL_GEO_URL}) not found. Please ensure it's in the public/data directory.`
              : fetchError.includes("Invalid map data structure") || fetchError.includes("objects."+TOPOJSON_OBJECT_KEY) ?
              `The map data file (${NEPAL_GEO_URL}) seems to have an invalid structure or is missing the '${TOPOJSON_OBJECT_KEY}' layer. Please verify the TopoJSON file.`
              : fetchError)
            : "Could not load map data. Please try again later."}
        </p>
        <p className="text-xs mt-2">Ensure map files are in /public/data/ and Firebase collections are populated & correctly configured.</p>
      </div>
    );
  }
  
  if (!mapData.objects || !mapData.objects[TOPOJSON_OBJECT_KEY]) {
      console.error(`HomepageMap: Critical error - TopoJSON 'objects' property or the specified layer key '${TOPOJSON_OBJECT_KEY}' is missing. Loaded mapData.objects:`, mapData.objects);
      return (
          <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
              <InfoIcon className="h-10 w-10 mb-2" />
              <p className="font-semibold text-lg mb-1">Map Data Structure Error</p>
              <p className="text-sm">The TopoJSON file is missing the expected layer named &quot;{TOPOJSON_OBJECT_KEY}&quot; or its structure is invalid.</p>
          </div>
      );
  }

  const geoObject = mapData.objects[TOPOJSON_OBJECT_KEY] as GeometryCollection;
  if (!geoObject || typeof geoObject.geometries === 'undefined' || !Array.isArray(geoObject.geometries)) {
    console.error(`HomepageMap: Critical error - The layer object for key '${TOPOJSON_OBJECT_KEY}' does not contain a 'geometries' array or is not a GeometryCollection. Layer content:`, geoObject);
    return (
        <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
            <InfoIcon className="h-10 w-10 mb-2" />
            <p className="font-semibold text-lg mb-1">Map Layer Error</p>
            <p className="text-sm">The specified layer &quot;{TOPOJSON_OBJECT_KEY}&quot; in your TopoJSON file is not a valid GeometryCollection or is missing geometries.</p>
        </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef} 
      className="relative w-full aspect-[16/9] bg-green-100 dark:bg-green-900/20 rounded-xl overflow-hidden border border-border"
      onClick={closeInfoBox} 
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 2800, 
          center: [84.1240, 28.3949] 
        }}
        className="w-full h-full"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
          <Geographies 
            geography={mapData} 
            parseGeographies={data => {
                const key = TOPOJSON_OBJECT_KEY;
                const layer = data.objects[key!];
                if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                    return layer.geometries;
                }
                if (layer && ["Polygon", "MultiPolygon"].includes(layer.type)) return [layer];
                console.warn(`parseGeographies (provinces): Layer for key "${key}" is not a GeometryCollection or recognized single geometry. Returning empty. Layer content:`, layer);
                return [];
            }}
          >
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ProvinceMapData; // Assuming properties match ProvinceMapData
                const geoId = geo.rsmKey || properties?.id?.toString() || properties?.ID?.toString() || properties?.OBJECTID?.toString() || String(Math.random());
                const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === 'Province';
                const provinceName = properties?.name || properties?.ADM1_EN || properties?.DIST_EN || "Unknown Province";
                
                const detailsFromState = provinceDetails[provinceName.toLowerCase().replace(/\s+/g, '_')] || 
                                         provinceDetails[geoId.toLowerCase().replace(/\s+/g, '_')] || 
                                         {name: provinceName, type: 'Province', link: `/districts?name=${encodeURIComponent(provinceName)}`, id: geoId, description: `Explore ${provinceName}.`, population: 'N/A'};

                return (
                  <Geography
                    key={geo.rsmKey || geoId}
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(detailsFromState, event)}
                    className={
                      `cursor-pointer transition-colors duration-150 ease-out 
                       ${isSelected ? 'fill-accent/70 dark:fill-accent/50 stroke-accent-foreground dark:stroke-accent-foreground/70 stroke-[0.75px]' 
                                  : 'fill-white dark:fill-gray-800 stroke-gray-400 dark:stroke-gray-600 stroke-[0.25px] hover:fill-accent/30 dark:hover:fill-accent/20'}`
                    }
                  />
                );
              })
            }
          </Geographies>

          <Geographies
            geography={mapData}
             parseGeographies={data => {
                const key = TOPOJSON_OBJECT_KEY;
                const layer = data.objects[key!];
                if (layer && layer.type === "GeometryCollection" && Array.isArray(layer.geometries)) {
                    return layer.geometries;
                }
                 if (layer && ["Polygon", "MultiPolygon"].includes(layer.type)) return [layer];
                console.warn(`parseGeographies (labels): Layer for key "${key}" is not a GeometryCollection or recognized single geometry. Returning empty. Layer content:`, layer);
                return [];
            }}
          >
            {({ geographies }) =>
                geographies.map(geo => {
                    const properties = geo.properties as ProvinceMapData;
                    const provinceName = properties?.name || properties?.NAME_1 || properties?.ADM1_EN || "Province";
                    const centroid = (geo as any).centroid as [number, number] | undefined; 
                    if (!centroid) return null;

                    let fontSize = 5;
                    if (["Kathmandu", "Pokhara", "Lumbini"].includes(provinceName)) fontSize = 6;

                    return (
                        <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
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
            const cityDisplayName = cityInfoFromState.name || "Unknown City";
            let fontSize = 5;
            if (["Kathmandu", "Pokhara", "Lumbini"].includes(cityDisplayName)) fontSize = 6;


            return (
              <Marker key={city.id} coordinates={city.coordinates} onClick={(event) => handleFeatureClick(cityInfoFromState, event)}>
                 <g
                  className={`cursor-pointer transition-all duration-150 ease-out 
                  ${isSelected ? 'fill-accent stroke-accent-foreground' 
                               : 'fill-primary stroke-primary-foreground hover:fill-accent hover:stroke-accent-foreground'}`}
                >
                  <circle r={isSelected ? 3.5 : 2.5} className="opacity-80" />
                  <circle r={isSelected ? 2 : 1} />
                </g>
                <text
                  textAnchor="middle"
                  y={-8}
                  fontSize={fontSize}
                  className={`select-none pointer-events-none transition-opacity duration-150 
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/80 dark:fill-foreground/60 hover:opacity-100'}`}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                >
                  {cityDisplayName}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

    {selectedFeatureInfo && (
      <Card
        className="fixed p-0 w-60 md:w-64 shadow-2xl border border-border z-[60] transition-all duration-200 ease-out bg-card text-card-foreground rounded-lg"
        style={{
          left: `${selectedFeatureInfo.pageX + 15}px`,
          top: `${selectedFeatureInfo.pageY + 15}px`,
          transform: mapContainerRef.current && selectedFeatureInfo.pageX > mapContainerRef.current.offsetWidth - (256 + 30) 
                        ? 'translateX(calc(-100% - 30px))' 
                        : 'translateX(0)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold leading-none flex items-center text-primary">
              <MapPin className="w-4 h-4 mr-1.5" />
              {selectedFeatureInfo.feature.name || "Details"}
            </CardTitle>
            {selectedFeatureInfo.feature.type && <CardDescription className="text-xs text-muted-foreground pt-0.5">{selectedFeatureInfo.feature.type}</CardDescription>}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" onClick={closeInfoBox} aria-label="Close info box">
            <XIcon className="w-4 h-4" />
          </Button>
        </CardHeader>
        {(selectedFeatureInfo.feature.description || selectedFeatureInfo.feature.population) && (
            <CardContent className="p-3 text-xs space-y-1.5">
            {selectedFeatureInfo.feature.population && (
                <p className="text-muted-foreground">
                <span className="font-medium text-foreground/80">Population:</span> {Number(selectedFeatureInfo.feature.population).toLocaleString()}
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
              className="w-full h-8 text-xs text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground"
              onClick={() => router.push(selectedFeatureInfo.feature.link!)}
            >
              Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
            </Button>
          </CardFooter>
        )}
      </Card>
    )}
    </div>
  );
}
