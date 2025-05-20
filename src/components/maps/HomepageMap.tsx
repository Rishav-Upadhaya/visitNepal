
"use client";

import type { ExtendedFeature, ExtendedProvinceMapData, ExtendedCityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react';
import { feature as topojsonFeature, type Topology } from 'topojson-client';

// This should match the main layer name in your TopoJSON file that contains the province/district geometries
const TOPOJSON_OBJECT_KEY = "nepal"; // Or "provinces", "districts" etc. - CHECK YOUR FILE
const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json"; // Ensure this file exists in public/data

interface SelectedFeatureDisplayInfo {
  feature: Partial<ExtendedProvinceMapData> & { name: string; link?: string; description?: string; properties?: any; id?: string; type: 'Province' | 'City'; coordinates?: [number, number] };
  pageX: number;
  pageY: number;
}

// Predefined data for major cities. Can be expanded.
const majorCities: Array<Omit<ExtendedCityMapData, 'population' | 'description'>> = [
  { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', highlight: true, link: '/districts?name=Kathmandu' },
  { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', highlight: true, link: '/districts?name=Pokhara' },
  { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', highlight: true, link: '/districts?name=Lumbini' },
];


export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureDisplayInfo | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setSelectedFeatureInfo(null); // Clear any selected feature on new data load

      try {
        console.log(`HomepageMap: Fetching map geometry from ${NEPAL_GEO_URL}...`);
        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          const errorMsg = `Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText.substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          throw new Error(errorMsg);
        }
        const rawMapData: Topology = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON fetched successfully. Parsed data sample:", JSON.stringify(rawMapData, null, 2).substring(0, 200) + "...");

        if (rawMapData && typeof rawMapData === 'object' && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          if (layer && typeof layer === 'object' && 'geometries' in layer && Array.isArray((layer as any).geometries)) {
            const geoJsonFeatures = topojsonFeature(rawMapData, layer as any).features as ExtendedFeature[];
            setMapData(geoJsonFeatures);
            console.log(`HomepageMap: TopoJSON processed into ${geoJsonFeatures.length} GeoJSON features.`);
          } else {
            const errorMsg = `Invalid TopoJSON structure: Layer key "${TOPOJSON_OBJECT_KEY}" does not contain a 'geometries' array or is not a GeometryCollection. Check your TopoJSON file. Layer content: ${JSON.stringify(layer).substring(0,200)}...`;
            console.error("HomepageMap:", errorMsg);
            setFetchError(errorMsg);
            setMapData(null);
          }
        } else {
          const errorMsg = `Invalid TopoJSON structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0,200)}...`;
          console.error("HomepageMap:", errorMsg);
          setFetchError(errorMsg);
          setMapData(null);
        }
      } catch (err) {
        console.error("HomepageMap: Error fetching or processing map geometry:", err);
        const specificError = err instanceof Error ? err.message : "An unknown error occurred while fetching map geometry.";
        setFetchError(specificError);
        setMapData(null);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };

    fetchData();
  }, []);


  useEffect(() => {
     console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  const handleFeatureClick = useCallback((
    featureData: Partial<ExtendedProvinceMapData> & { name: string; link?: string; description?: string; properties?: any; id?: string; type: 'Province' | 'City'; coordinates?: [number, number]},
    event: React.MouseEvent<SVGElement | SVGGElement>
  ) => {
    event.stopPropagation();
    console.log("Feature Clicked:", featureData.name, "Event pageX:", event.pageX, "pageY:", event.pageY, "Feature Data:", featureData);
    setSelectedFeatureInfo({
      feature: featureData,
      pageX: event.pageX,
      pageY: event.pageY,
    });
  }, []);

  const closeInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
  }, []);


  if (isLoadingMapGeometry) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 dark:bg-muted/30 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold">Initializing Interactive Map...</p>
      </div>
    );
  }
  
  let displayErrorMessage = fetchError;

  if (fetchError) {
      if (fetchError.includes("offline") || fetchError.includes("Failed to get document")) {
        displayErrorMessage = `Map Error: Could not connect to data service. Please verify your Firebase configuration (especially environment variables like NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or hosting settings) and internet connection. Ensure Firestore is enabled in your Firebase project. Original: ${fetchError}`;
      } else if (fetchError.includes("Invalid TopoJSON structure") || fetchError.includes("Invalid GeoJSON data structure") || fetchError.includes("404")) {
         displayErrorMessage = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid (TopoJSON for this setup), and contains the expected layer ('${TOPOJSON_OBJECT_KEY}') with geometries. Original: ${fetchError}`;
      }
  }
  
  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage || "Map data is currently unavailable. Please check console for details."}</p>
      </div>
    );
  }


  return (
    <div
      ref={mapContainerRef}
      className="relative w-full aspect-[16/9] bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={closeInfoBox} // Close info box if map background is clicked
    >
       {/* Debug text to show selected feature info */}
      {/* <div style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(255,255,0,0.7)', padding: '5px', zIndex: 10000, color: 'black' }}>
        {selectedFeatureInfo ? `DEBUG Info: ${selectedFeatureInfo.feature.name} at X:${selectedFeatureInfo.pageX}, Y:${selectedFeatureInfo.pageY}` : "DEBUG: Click a feature"}
      </div> */}

       <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 2800, // Adjusted for Nepal
          center: [84.1240, 28.3949] // Center of Nepal
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing provinces and major cities"
      >
        <ZoomableGroup center={[84.1240, 28.3949]} zoom={1}>
          <Geographies 
            geography={mapData} // mapData is an array of GeoJSON features
          >
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedProvinceMapData['properties'] & { name?: string }; // Ensure name might exist
                const provinceName = properties?.name || properties?.ADM1_EN || properties?.DIST_EN || "Unknown Area";
                const geoId = String(geo.id || geo.rsmKey || provinceName + Math.random());
                
                const isSelected = selectedFeatureInfo?.feature.id === geoId && selectedFeatureInfo.feature.type === 'Province';

                const featureDataForInfoBox: SelectedFeatureDisplayInfo['feature'] = {
                  id: geoId,
                  name: provinceName,
                  type: 'Province',
                  description: properties?.description || `Explore ${provinceName}.`, // Use description from properties if available
                  link: properties?.link || `/districts?name=${encodeURIComponent(provinceName)}`,
                  properties: geo.properties || {}
                };

                return (
                  <Geography
                    key={geoId}
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => {
                       event.stopPropagation(); // Prevent map click from closing info box immediately
                       handleFeatureClick(featureDataForInfoBox, event as any);
                    }}
                    className={
                      `transition-all duration-150 ease-out outline-none
                       ${isSelected 
                            ? 'fill-accent/70 dark:fill-accent/60 stroke-accent-foreground dark:stroke-accent-foreground/80 stroke-[1.5px]' 
                            : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-500 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer'
                       }`
                    }
                    aria-label={provinceName}
                  />
                );
              })
            }
          </Geographies>

          {/* Layer for Province Labels */}
           <Geographies
            geography={mapData} // mapData is an array of GeoJSON features
          >
            {({ geographies }) =>
                geographies.map(geo => {
                    const properties = geo.properties as ExtendedProvinceMapData['properties'] & { name?: string };
                    const provinceName = properties?.name || properties?.ADM1_EN || properties?.DIST_EN || "";
                    const centroid = (geo as any).centroid as [number, number] | undefined; // Attempt to access if react-simple-maps populates it

                    if (!centroid || !provinceName) return null;

                    let fontSize = 5;
                    let yOffset = 0;
                     // Adjust font size for specific provinces to reduce overlap
                    if (["Bagmati", "Lumbini Province", "Gandaki", "Koshi"].some(p => provinceName.includes(p))) {
                        fontSize = provinceName.includes("Bagmati") || provinceName.includes("Lumbini Province") ? 6 : 5.5;
                    }
                    if (provinceName.length > 15) fontSize = Math.max(3.5, fontSize - 1.5);
                    if (provinceName.length > 20) fontSize = Math.max(3, fontSize - 1);


                    return (
                        <Marker key={`label-${geo.id || geo.rsmKey}`} coordinates={centroid}>
                            <text
                                x={0}
                                y={yOffset}
                                fontSize={fontSize}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="fill-foreground dark:fill-background pointer-events-none select-none"
                                style={{ paintOrder: "stroke", stroke: "hsl(var(--background)) dark:hsl(var(--foreground))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                            >
                                {provinceName.replace(" Province", "").replace(" Pradesh", "")}
                            </text>
                        </Marker>
                    );
                })
            }
          </Geographies>

          {/* Layer for Major City Markers */}
          {majorCities.map((cityPreset) => {
            const cityToDisplay: SelectedFeatureDisplayInfo['feature'] = {
              ...cityPreset,
              description: cityPreset.description || `Discover ${cityPreset.name}, a major hub in Nepal.`,
              link: cityPreset.link || `/districts?name=${encodeURIComponent(cityPreset.name)}`,
            };

            const isSelected = selectedFeatureInfo?.feature.id === cityToDisplay.id && selectedFeatureInfo?.feature.type === 'City';
            
            let labelFontSize = 6;
            let yTextOffset = -8;
            if (cityToDisplay.name === "Kathmandu") {
              labelFontSize = 7;
              yTextOffset = -9;
            } else if (["Pokhara", "Lumbini"].includes(cityToDisplay.name)) {
              labelFontSize = 6;
              yTextOffset = -8;
            }


            return (
              <Marker
                key={cityToDisplay.id}
                coordinates={cityToDisplay.coordinates!}
                onClick={(event: any) => { // react-simple-maps marker onClick provides event
                  event.stopPropagation();
                  handleFeatureClick(cityToDisplay, event);
                }}
              >
                 <g
                  className={`cursor-pointer transition-all duration-150 group`}
                >
                  <circle
                    r={isSelected ? 6 : 4}
                    className={isSelected 
                        ? 'fill-accent stroke-accent-foreground dark:fill-accent dark:stroke-accent-foreground'
                        : 'fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground'}
                    strokeWidth={0.75}
                  />
                </g>
                <text
                  textAnchor="middle"
                  y={yTextOffset}
                  fontSize={labelFontSize}
                  className={`select-none pointer-events-none transition-opacity duration-150
                    ${isSelected ? 'opacity-100 fill-accent font-semibold' : 'opacity-70 fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent'}`}
                    style={{ paintOrder: "stroke", stroke: "hsl(var(--background)) dark:hsl(var(--foreground))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                >
                  {cityToDisplay.name}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

    {/* Info Box */}
    {selectedFeatureInfo && mapContainerRef.current && (
        <Card
            className="fixed p-0 w-64 md:w-72 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[1001] transition-all duration-200 ease-out"
            style={{
                left: `${selectedFeatureInfo.pageX + 15}px`,
                top: `${selectedFeatureInfo.pageY + 15}px`,
                transform: selectedFeatureInfo.pageX > (mapContainerRef.current.offsetWidth - (mapContainerRef.current.offsetWidth > 768 ? 288 + 30 : 256 + 30)) 
                                ? 'translateX(calc(-100% - 30px))' 
                                : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent map click handler from closing this
        >
            <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-base font-semibold leading-tight flex items-center text-primary">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                    {selectedFeatureInfo.feature.type && <p className="text-xs text-muted-foreground pt-0.5 pl-[1.375rem]">{selectedFeatureInfo.feature.type}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" onClick={closeInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
            {(selectedFeatureInfo.feature.description || typeof selectedFeatureInfo.feature.population === 'number') && (
                <CardContent className="p-3 text-xs space-y-1">
                {typeof selectedFeatureInfo.feature.population === 'number' && (
                    <p className="text-muted-foreground">
                    <span className="font-medium text-foreground/90">Population:</span> {Number(selectedFeatureInfo.feature.population).toLocaleString()}
                    </p>
                )}
                {selectedFeatureInfo.feature.description && (
                    <CardDescription className="text-xs text-muted-foreground line-clamp-3 !mt-1">
                      {selectedFeatureInfo.feature.description}
                    </CardDescription>
                )}
                 {!selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground/70 text-xs italic">No detailed description available for this location.</p>
                 )}
                </CardContent>
            )}
            {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 border-t pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs text-accent-foreground border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
                    onClick={() => {
                        if(selectedFeatureInfo.feature.link) router.push(selectedFeatureInfo.feature.link);
                        closeInfoBox();
                    }}
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

