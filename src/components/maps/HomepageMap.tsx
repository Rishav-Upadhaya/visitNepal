
"use client";

import type { ExtendedFeature, ProvinceMapData, CityMapData } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, XIcon, InfoIcon, Globe, Loader2 } from 'lucide-react'; // Added Loader2
import { feature as topojsonFeature, type Topology } from 'topojson-client';
import { getDistrictDescription } from '@/ai/flows/get-district-description-flow';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase'; // Assuming db is correctly initialized
import { doc, getDoc } from 'firebase/firestore';

const NEPAL_GEO_URL = "/data/nepal-provinces-topo.json";
const TOPOJSON_OBJECT_KEY = "nepal"; // Key in TopoJSON objects holding the main geometry collection

// Combined type for feature properties that could be selected for the info box
interface ExtendedProvinceProperties extends ProvinceMapData {
  id: string;
  name: string;
  type: 'District';
  description?: string; // Make description optional
  link?: string;
  population?: number;
}

interface ExtendedCityProperties extends CityMapData {
  id: string;
  name: string;
  type: 'City';
  description?: string;
  link?: string;
  population?: number;
  highlight?: boolean;
  coordinates: [number, number];
}

type SelectedFeatureDisplayData = ExtendedProvinceProperties | ExtendedCityProperties;


interface SelectedFeatureState {
  feature: SelectedFeatureDisplayData;
  pageX: number;
  pageY: number;
}

// Flag to control Firestore fetching for city/province details (can be turned off for dev/if data not ready)
const FETCH_DETAILS_FROM_FIRESTORE = true;

export function HomepageMap() {
  const [mapData, setMapData] = useState<ExtendedFeature[] | null>(null);
  const [isLoadingMapGeometry, setIsLoadingMapGeometry] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [displayErrorMessage, setDisplayErrorMessage] = useState<string | null>(null);
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<SelectedFeatureState | null>(null);

  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);

  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const majorCities: ExtendedCityProperties[] = [
    { id: 'kathmandu', name: 'Kathmandu', coordinates: [85.3240, 27.7172], type: 'City', description: "The vibrant capital, rich in culture and ancient temples.", population: 1442271, link: '/districts?name=Kathmandu', highlight: true },
    { id: 'pokhara', name: 'Pokhara', coordinates: [83.9856, 28.2096], type: 'City', description: "A picturesque city by Phewa Lake with stunning Himalayan views.", population: 400000, link: '/districts?name=Kaski', highlight: true },
    { id: 'lumbini', name: 'Lumbini', coordinates: [83.2747, 27.4670], type: 'City', description: "The sacred birthplace of Lord Buddha, a UNESCO World Heritage site.", population: 70000, link: '/districts?name=Rupandehi', highlight: true },
    { id: 'biratnagar', name: 'Biratnagar', coordinates: [87.2798, 26.4525], type: 'City', description: "Major industrial city and hub in Eastern Nepal.", population: 242548, link: '/districts?name=Morang', highlight: true },
    { id: 'nepalgunj', name: 'Nepalgunj', coordinates: [81.6167, 28.0500], type: 'City', description: "Key transport and trade hub in Western Nepal, near Indian border.", population: 138951, link: '/districts?name=Banke', highlight: true },
    { id: 'janakpur', name: 'Janakpur', coordinates: [85.9228, 26.7285], type: 'City', description: "Historic city, religious center, and birthplace of Goddess Sita.", population: 195438, link: '/districts?name=Dhanusha', highlight: true },
  ];


  const generateDescriptionForDistrict = useCallback(async (districtName: string) => {
    if (!districtName) return;
    setIsFetchingDescription(true);
    setAiDescription(null);
    try {
      console.log(`HomepageMap: Requesting AI description for district: ${districtName}`);
      const result = await getDistrictDescription({ districtName });
      if (result && result.description) {
        setAiDescription(result.description);
        console.log(`HomepageMap: AI description for ${districtName} received:`, result.description);
      } else {
        throw new Error("AI did not return a valid description.");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown AI description error";
      console.error(`HomepageMap: Error generating AI description for ${districtName}:`, errorMsg);
      toast({
        title: "AI Description Error",
        description: `Could not load AI details for ${districtName}.`,
        variant: "default",
      });
      setAiDescription(null); // Ensure it's reset on error
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);


  const handleFeatureClick = useCallback(async (
    featureProperties: any, // properties from TopoJSON geometry or from majorCities
    featureType: 'District' | 'City',
    event: React.MouseEvent<SVGPathElement | SVGGElement> // SVGGElement for Marker group
  ) => {
    event.stopPropagation();

    const districtName = featureProperties?.name || featureProperties?.DIST_EN || featureProperties?.ADM1_EN || "Unknown Area";
    const featureId = String(featureProperties?.id || featureProperties?.rsmKey || districtName + Math.random());
    
    console.log(`${featureType} Clicked:`, districtName, "Event clientX:", (event as React.MouseEvent).clientX, "clientY:", (event as React.MouseEvent).clientY);
    
    let baseDescription = featureProperties?.description || `Explore ${districtName}, a diverse place in Nepal.`;
    let link = featureProperties?.link || `/districts?name=${encodeURIComponent(districtName)}`;
    let population = featureProperties?.population;

    if (FETCH_DETAILS_FROM_FIRESTORE && db) {
      try {
        const collectionName = featureType === 'District' ? 'nepal_provinces_data' : 'nepal_major_cities_data';
        const docRef = doc(db, collectionName, featureId); // Assuming featureId matches Firestore doc ID
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const details = docSnap.data();
          console.log(`${featureType} details from Firestore for ${districtName} (ID: ${featureId}):`, details);
          baseDescription = details.description || baseDescription;
          link = details.link || link;
          population = details.population || population;
        } else {
          console.warn(`No Firestore details found for ${featureType} ${districtName} (ID: ${featureId})`);
        }
      } catch (err) {
        console.error(`Error fetching ${featureType} details from Firestore for ${districtName}:`, err);
        // Do not overwrite baseDescription if Firestore fetch fails, let it use local/TopoJSON data
      }
    }
    
    const featureData: SelectedFeatureDisplayData = {
      id: featureId,
      name: districtName,
      type: featureType,
      population: population,
      description: baseDescription, // This will be used as fallback
      link: link,
      // For City type, ensure coordinates are passed if they exist on featureProperties
      ...(featureType === 'City' && featureProperties.coordinates && { coordinates: featureProperties.coordinates }),
      ...(featureType === 'City' && typeof featureProperties.highlight !== 'undefined' && { highlight: featureProperties.highlight }),
    };

    setSelectedFeatureInfo({
      feature: featureData,
      pageX: (event as React.MouseEvent).clientX,
      pageY: (event as React.MouseEvent).clientY,
    });

    // Fetch AI description only for districts
    if (featureType === 'District') {
      generateDescriptionForDistrict(districtName);
    } else {
      setAiDescription(null); // Clear AI description if it's a city
      setIsFetchingDescription(false);
    }
  }, [generateDescriptionForDistrict]);


  const handleCloseInfoBox = useCallback(() => {
    setSelectedFeatureInfo(null);
    setAiDescription(null);
    setIsFetchingDescription(false);
  }, []);

  const handleMapClick = useCallback(() => {
    if (selectedFeatureInfo) {
      handleCloseInfoBox();
    }
  }, [selectedFeatureInfo, handleCloseInfoBox]);


  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMapGeometry(true);
      setFetchError(null);
      setDisplayErrorMessage(null);
      setMapData(null);

      try {
        if (!db && FETCH_DETAILS_FROM_FIRESTORE) {
            console.warn("HomepageMap: Firebase db instance is not available. Map details might be incomplete.");
            // Optionally, set a specific error or proceed without Firestore details
        }

        const geoRes = await fetch(NEPAL_GEO_URL);
        if (!geoRes.ok) {
          const errorText = await geoRes.text();
          throw new Error(`Failed to fetch map data from ${NEPAL_GEO_URL}: ${geoRes.status} ${geoRes.statusText}. Response: ${errorText}`);
        }
        const rawMapData: Topology = await geoRes.json();
        console.log("HomepageMap: Raw TopoJSON fetched successfully. Keys in objects:", Object.keys(rawMapData.objects || {}));

        if (rawMapData && rawMapData.objects && rawMapData.objects[TOPOJSON_OBJECT_KEY]) {
          const layer = rawMapData.objects[TOPOJSON_OBJECT_KEY];
          if (layer && (layer.type === "GeometryCollection" || layer.type === "MultiPolygon" || layer.type === "Polygon")) {
            const geoJsonFeatures = topojsonFeature(rawMapData, layer!).features as ExtendedFeature[];
             console.log(`HomepageMap: Successfully processed "${TOPOJSON_OBJECT_KEY}" layer into ${geoJsonFeatures.length} GeoJSON features.`);
            setMapData(geoJsonFeatures.map(f => ({
              ...f,
              properties: {
                ...f.properties,
                name: f.properties?.name || f.properties?.DIST_EN || f.properties?.ADM1_EN || "Unknown District",
                id: String(f.id || f.properties?.id || f.properties?.OBJECTID || f.properties?.name || Math.random())
              }
            })));
          } else {
            throw new Error(`Layer "${TOPOJSON_OBJECT_KEY}" in TopoJSON is not a valid GeometryCollection or recognizable geometry type.`);
          }
        } else {
          throw new Error(`Invalid TopoJSON data structure in ${NEPAL_GEO_URL}. Expected TopoJSON with an 'objects.${TOPOJSON_OBJECT_KEY}' property. Received: ${JSON.stringify(rawMapData).substring(0, 200)}...`);
        }
      } catch (err) {
        let specificError = err instanceof Error ? err.message : "An unknown error occurred while loading map data.";
        if (specificError.includes("offline") || specificError.includes("Failed to get document")) {
            specificError = `Could not connect to Firebase to fetch map details. Please ensure your Firebase setup (including environment variables for API keys, project ID, etc.) is correct, and check your internet connection. Original error: ${specificError}`;
        } else if (specificError.includes("404") && specificError.includes(NEPAL_GEO_URL)) {
            specificError = `Map Error: The map data file (${NEPAL_GEO_URL}) was not found. Please ensure it exists in your /public/data directory.`;
        } else if (specificError.includes("Invalid TopoJSON") || specificError.includes(`objects.${TOPOJSON_OBJECT_KEY}`)) {
            specificError = `Map Error: Problem loading map geometry from ${NEPAL_GEO_URL}. Ensure the file exists, is valid TopoJSON, and contains the expected layer ('${TOPOJSON_OBJECT_KEY}') with geometries. Original: ${specificError}`;
        }
        console.error("HomepageMap: fetchData error:", specificError);
        setFetchError(specificError);
      } finally {
        setIsLoadingMapGeometry(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    setDisplayErrorMessage(fetchError);
  }, [fetchError]);

  // Debug: Log selectedFeatureInfo when it changes
  useEffect(() => {
     console.log("HomepageMap: selectedFeatureInfo updated:", selectedFeatureInfo);
  }, [selectedFeatureInfo]);


  if (isLoadingMapGeometry || (!mapData && !displayErrorMessage)) {
    return (
      <div className="aspect-[16/9] w-full bg-muted/20 dark:bg-muted/30 rounded-xl flex items-center justify-center text-primary p-4">
        <Skeleton className="h-full w-full" />
        <p className="absolute font-semibold flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Initializing Interactive Map of Nepal...</p>
      </div>
    );
  }
  
  if (displayErrorMessage || !mapData) {
    console.error("HomepageMap: Rendering error component. fetchError:", displayErrorMessage, "mapData valid:", !!mapData);
    return (
      <div className="aspect-[16/9] w-full bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center text-red-700 dark:text-red-300 p-4 text-center">
         <InfoIcon className="h-10 w-10 mb-2" />
        <p className="font-semibold text-lg mb-1">Map Data Error</p>
        <p className="text-sm">{displayErrorMessage || "An unexpected error occurred and map data is unavailable. Please ensure the TopoJSON file is correct and accessible."}</p>
      </div>
    );
  }
  

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full h-full bg-lime-100 dark:bg-green-900/30 rounded-xl overflow-hidden border border-border cursor-default"
      onClick={handleMapClick} // Closes info box if map background is clicked
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 4000, 
          center: [84.1240, 28.3949] // Centered on Nepal
        }}
        className="w-full h-full"
        aria-label="Interactive map of Nepal showing districts"
      >
          <Geographies 
            geography={mapData} // mapData is now an array of GeoJSON features
          >
            {({ geographies }) =>
              geographies.map(geo => {
                const properties = geo.properties as ExtendedProvinceProperties; 
                const districtName = properties?.name || "Unknown District";
                const featureIdForSelection = String(properties?.id || geo.rsmKey || districtName + Math.random());
                const isSelected = selectedFeatureInfo?.feature.id === featureIdForSelection && selectedFeatureInfo.feature.type === 'District';
                
                return (
                  <Geography
                    key={geo.rsmKey || featureIdForSelection} 
                    geography={geo}
                    onClick={(event: React.MouseEvent<SVGPathElement>) => handleFeatureClick(properties, 'District', event)}
                    className={cn(
                      "outline-none transition-all duration-150 ease-out",
                      isSelected
                        ? 'fill-accent stroke-accent-foreground stroke-[1.5px]' // Prominent selected style
                        : 'fill-card dark:fill-gray-700 stroke-border dark:stroke-gray-600 stroke-[0.5px] hover:fill-accent/40 dark:hover:fill-accent/30 cursor-pointer'
                    )}
                    aria-label={districtName}
                  />
                );
              })
            }
          </Geographies>
          {/* Render District Labels */}
           <Geographies geography={mapData}>
            {({ geographies }) =>
              geographies.map((geo, i) => {
                const properties = geo.properties as ExtendedProvinceProperties;
                const districtName = properties?.name || "Unknown District";
                const centroid = (geo as any).centroid as [number, number] | undefined; // react-simple-maps adds centroid

                if (!centroid || !districtName) return null;

                // Basic attempt to declutter by only showing labels for larger features or based on some logic
                // This is a very simple heuristic and might need significant improvement for a real map
                const area = (geo as any).area; // react-simple-maps might add area
                let fontSize = 4;
                if (area && area > 0.1) fontSize = 5; // Example threshold
                if (districtName === "Kathmandu") fontSize = 7;


                return (
                  <Marker key={`label-${geo.rsmKey || districtName + i}`} coordinates={centroid}>
                    <text
                      x={0}
                      y={0}
                      fontSize={fontSize}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      className="fill-foreground/80 dark:fill-background/90 pointer-events-none select-none font-medium"
                      style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.3px", strokeLinejoin: "round" }}
                    >
                      {districtName}
                    </text>
                  </Marker>
                );
              })
            }
          </Geographies>
          {/* Render Major City Markers */}
          {majorCities.map((city) => {
            const isSelected = selectedFeatureInfo?.feature.id === city.id && selectedFeatureInfo.feature.type === 'City';
            let labelFontSize = 6;
            if (city.name === "Kathmandu" || city.name === "Pokhara" || city.name === "Lumbini") {
                labelFontSize = city.name === "Kathmandu" ? 9 : 7;
            }

            return (
              <Marker
                key={city.id}
                coordinates={city.coordinates}
                onClick={(event) => handleFeatureClick(city, 'City', event as unknown as React.MouseEvent<SVGGElement>)} // Cast event type if needed
              >
                <g
                  className={cn(
                    "transition-all group cursor-pointer",
                    isSelected ? 'text-accent' : 'text-primary hover:text-accent/80'
                  )}
                >
                  <circle
                    r={isSelected ? 6 : 4}
                    className={cn(
                      isSelected ? 'fill-accent stroke-accent-foreground' : 'fill-primary stroke-primary-foreground group-hover:fill-accent/80 group-hover:stroke-accent-foreground'
                    )}
                    strokeWidth={0.5}
                  />
                  {/* Use MapPin icon if desired, or keep circle */}
                  {/* <MapPin className={cn("w-4 h-4 -translate-x-2 -translate-y-4", isSelected ? "fill-accent" : "fill-primary group-hover:fill-accent")} /> */}

                  <text
                    textAnchor="middle"
                    y={isSelected ? -10 : -8} 
                    fontSize={labelFontSize}
                    className={cn(
                      "select-none pointer-events-none transition-opacity duration-150 font-semibold",
                      isSelected ? 'opacity-100 fill-accent' : 'opacity-80 fill-foreground/90 dark:fill-background group-hover:opacity-100 group-hover:fill-accent'
                    )}
                     style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: "0.5px", strokeLinejoin: "round" }}
                  >
                    {city.name}
                  </text>
                </g>
              </Marker>
            );
          })}
      </ComposableMap>

      {/* Info Box - positioned by click */}
      {selectedFeatureInfo && mapContainerRef.current && (
          <Card
            className={cn(
                "fixed p-0 w-64 sm:w-72 md:w-80 shadow-2xl border border-border bg-card text-card-foreground rounded-lg z-[1000] transition-all duration-200 ease-out"
            )}
            style={{
                left: `${Math.min(selectedFeatureInfo.pageX + 15, (window.innerWidth) - (selectedFeatureInfo.pageX + 15 + (mapContainerRef.current.offsetWidth > 768 ? 320 : 256) > window.innerWidth ? ((mapContainerRef.current.offsetWidth > 768 ? 320 : 256) + 30) : 0)  )}px`,
                top: `${Math.min(selectedFeatureInfo.pageY + 15, (window.innerHeight) - 150 - 15 )}px`, // Approx height of info box
                transform: selectedFeatureInfo.pageX + 15 + (mapContainerRef.current.offsetWidth > 768 ? 320 : 256) > window.innerWidth ? 'translateX(calc(-100% - 30px))' : 'translateX(0)',
            }}
            onClick={(e) => e.stopPropagation()} 
          >
            <CardHeader className="flex flex-row items-start justify-between p-3 space-y-0 border-b bg-muted/50 rounded-t-lg">
                <div className="space-y-0.5">
                    <CardTitle className="text-lg font-bold leading-tight flex items-center text-primary">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary/80" />
                        {selectedFeatureInfo.feature.name || "Details"}
                    </CardTitle>
                     {selectedFeatureInfo.feature.type && <p className="text-xs text-muted-foreground pt-0.5 pl-[1.375rem]">{selectedFeatureInfo.feature.type}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" onClick={handleCloseInfoBox} aria-label="Close info box">
                    <XIcon className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-3 text-sm max-h-32 overflow-y-auto">
                {isFetchingDescription && selectedFeatureInfo.feature.type === 'District' && (
                     <div className="flex items-center text-muted-foreground my-1">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating description...
                    </div>
                )}
                {/* Display AI description if available and type is District, otherwise fallback */}
                {selectedFeatureInfo.feature.type === 'District' && aiDescription && !isFetchingDescription && (
                     <p className="text-muted-foreground line-clamp-4 !mt-1">{aiDescription}</p>
                )}
                {/* Fallback to feature's own description if AI isn't fetching or isn't available/applicable */}
                {(!isFetchingDescription && !(selectedFeatureInfo.feature.type === 'District' && aiDescription)) && selectedFeatureInfo.feature.description && (
                     <p className="text-muted-foreground line-clamp-4 !mt-1">{selectedFeatureInfo.feature.description}</p>
                )}
                 {/* Generic fallback if no description at all */}
                {(!isFetchingDescription && !(selectedFeatureInfo.feature.type === 'District' && aiDescription)) && !selectedFeatureInfo.feature.description && (
                    <p className="text-muted-foreground italic line-clamp-4 !mt-1">Explore {selectedFeatureInfo.feature.name}, a notable area in Nepal.</p>
                )}

                 {selectedFeatureInfo.feature.population && (
                    <p className="text-muted-foreground/80 mt-1.5 text-[11px]">Population: {selectedFeatureInfo.feature.population.toLocaleString()}</p>
                )}
            </CardContent>
            {selectedFeatureInfo.feature.link && (
            <CardFooter className="p-3 border-t pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground/90"
                    onClick={() => {
                        if(selectedFeatureInfo.feature.link) router.push(selectedFeatureInfo.feature.link);
                        handleCloseInfoBox();
                    }}
                >
                    Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
                </Button>
            </CardFooter>
            )}
        </Card>
    )}
    {/* Loading indicator for AI description (if a district is selected but description is still fetching) */}
    {isFetchingDescription && !isLoadingMapGeometry && (
        <div className="absolute bottom-2 right-2 p-2 bg-muted/80 text-muted-foreground text-xs rounded-md flex items-center gap-2 z-50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading details...
        </div>
    )}
    </div>
  );
}
