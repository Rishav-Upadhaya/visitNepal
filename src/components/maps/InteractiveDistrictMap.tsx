
// src/components/maps/InteractiveDistrictMap.tsx
"use client";

import type { LatLngExpression, LeafletMouseEvent, Layer, PathOptions, DivIcon } from 'leaflet';
// CSS IMPORTS (CRUCIAL for Leaflet to work)
import 'leaflet/dist/leaflet.css'; 
// Recommended for resolving default icon issues with webpack
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'; 
import 'leaflet-defaulticon-compatibility'; 

import L from 'leaflet'; // Import L for L.divIcon
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, InfoIcon, ExternalLink, XIcon, MapPin } from 'lucide-react';
import type { DistrictFeature, DistrictProperties, GeoJSON as LocalGeoJSON } from '@/types';
import { Button } from '@/components/ui/button';

// Information for the click info-box
interface ClickedDistrictInfo {
  name: string;
  description?: string;
  learnMoreUrl: string;
  x: number; // pageX
  y: number; // pageY
}

// Information for the user's geolocated position
interface UserLocationInfo {
  lat: number;
  lng: number;
  name: string; // Reverse-geocoded name
}

// Helper component to adjust map view if needed
const ChangeView = ({ center, zoom }: { center: LatLngExpression; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
};

export function InteractiveDistrictMap() {
  const [districtFeatureCollection, setDistrictFeatureCollection] = useState<LocalGeoJSON.FeatureCollection<LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon, DistrictProperties> | null>(null);
  const [clickedDistrictInfo, setClickedDistrictInfo] = useState<ClickedDistrictInfo | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null);
  const infoBoxRef = useRef<HTMLDivElement>(null);

  // Fetch district GeoJSON data from Firestore
  useEffect(() => {
    const fetchDistrictsData = async () => {
      setLoading(true);
      setMapError(null);
      try {
        const querySnapshot = await getDocs(collection(db, 'districts'));
        if (querySnapshot.empty) {
          setMapError("No district data found. Ensure 'districts' collection in Firestore has documents with 'name', 'learnMoreUrl', and GeoJSON 'geometry' fields.");
          setDistrictFeatureCollection(null);
          return;
        }
        
        const features: DistrictFeature[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          if (!data.geometry || !data.name || !data.learnMoreUrl) {
            console.warn(`Skipping district document ${doc.id} due to missing critical fields (name, learnMoreUrl, or geometry).`);
            return null; 
          }
          return {
            type: "Feature",
            properties: {
              name: data.name,
              learnMoreUrl: data.learnMoreUrl,
              description: data.description || 'No description available.',
            },
            geometry: data.geometry as LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon
          };
        }).filter(feature => feature !== null) as DistrictFeature[]; // Filter out nulls

        if (features.length === 0) {
          setMapError("No valid district features could be constructed. Check Firestore data and console warnings.");
          setDistrictFeatureCollection(null);
          return;
        }

        const featureCollection: LocalGeoJSON.FeatureCollection<LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon, DistrictProperties> = {
          type: "FeatureCollection",
          features: features,
        };
        
        setDistrictFeatureCollection(featureCollection);

      } catch (err) {
        console.error("Error fetching district data from Firestore:", err);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setMapError(`Failed to load district data. ${errorMsg.includes("offline") || errorMsg.includes("firestore/unavailable") ? "Please check your internet connection and Firebase setup." : errorMsg } Check console for details.`);
      } finally {
        setLoading(false);
      }
    };
    fetchDistrictsData();
  }, []);

  // Get user's geolocation
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const placeName = "Your Current Location"; // Placeholder - implement reverse geocoding for real name
          setUserLocation({ lat: latitude, lng: longitude, name: placeName });
        },
        (err) => {
          console.warn(`Geolocation permission denied or error: ${err.message}`);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    }
  }, []);
  
  // Close info box when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoBoxRef.current && !infoBoxRef.current.contains(event.target as Node) && mapRef.current && !mapRef.current.getPane('popupPane')?.contains(event.target as Node) ) {
         // Check if the click was on a map layer (polygon)
        let onPolygon = false;
        mapRef.current.eachLayer(layer => {
            if (layer instanceof L.Path && (layer as any)._path && (layer as any)._path.contains(event.target as Node)) {
                onPolygon = true;
            }
        });
        if (!onPolygon) {
          setClickedDistrictInfo(null);
        }
      }
    };

    if (clickedDistrictInfo) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [clickedDistrictInfo]);


  const onEachFeature = useCallback((feature: DistrictFeature, layer: Layer) => {
    const defaultStyle: PathOptions = {
      fillColor: 'hsl(var(--primary) / 0.1)',
      weight: 1,
      opacity: 1,
      color: 'hsl(var(--primary) / 0.6)',
      fillOpacity: 0.2,
    };
    const hoverStyle: PathOptions = {
      weight: 2,
      color: 'hsl(var(--accent))',
      fillColor: 'hsl(var(--accent) / 0.3)',
      fillOpacity: 0.5,
    };

    (layer as L.Path).setStyle(defaultStyle);

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        (e.target as L.Path).setStyle(hoverStyle);
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            e.target.bringToFront();
        }
      },
      mouseout: (e: LeafletMouseEvent) => {
        (e.target as L.Path).setStyle(defaultStyle);
      },
      click: (e: LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e); // Important to prevent map click handler from closing it immediately
        const properties = feature.properties;
        setClickedDistrictInfo({
          name: properties.name,
          description: properties.description,
          learnMoreUrl: properties.learnMoreUrl,
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
        });
      },
    });
  }, [router]);

  const geoJsonStyle = (): PathOptions => ({
    fillColor: 'hsl(var(--primary) / 0.1)',
    weight: 1,
    opacity: 1,
    color: 'hsl(var(--primary) / 0.6)', 
    fillOpacity: 0.2,
  });
  
  const initialCenter: LatLngExpression = [28.3949, 84.1240];
  const initialZoom = 7;

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Interactive Map of Nepal...</p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-destructive/10 text-destructive p-8 text-center">
        <InfoIcon className="h-12 w-12 mb-4" />
        <p className="text-xl font-semibold">Map Error</p>
        <p>{mapError}</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen_fixed_donot_change_this relative"> {/* Ensure relative positioning for absolute children if needed */}
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="bg-muted"
        whenCreated={mapInstance => { mapRef.current = mapInstance; }}
        onClick={() => setClickedDistrictInfo(null)} // Close info box on map click
      >
        <ChangeView center={initialCenter} zoom={initialZoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &amp; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
        />
        {districtFeatureCollection && districtFeatureCollection.features.length > 0 && (
          <GeoJSON
            key={JSON.stringify(districtFeatureCollection)} 
            data={districtFeatureCollection as LocalGeoJSON.GeoJsonObject} // Cast to GeoJsonObject for react-leaflet
            style={geoJsonStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {/* User's Current Location Marker */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>
              <div className="p-2 bg-background rounded-md shadow-lg border border-border">
                <h3 className="font-semibold text-sm text-primary mb-1 flex items-center">
                  <MapPin className="w-4 h-4 mr-1.5 text-accent"/>
                  {userLocation.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  (Estimated based on your browser)
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Click Info-box */}
      {clickedDistrictInfo && (
        <div
          ref={infoBoxRef}
          style={{
            left: `${clickedDistrictInfo.x + 15}px`, // Offset from cursor
            top: `${clickedDistrictInfo.y + 15}px`,  // Offset from cursor
            transform: clickedDistrictInfo.x > window.innerWidth - 270 ? 'translateX(-100%) translateX(-30px)' : 'none', // Adjust if too close to right edge
          }}
          className="fixed p-3 bg-background text-foreground rounded-lg shadow-xl border border-border text-sm z-[1001] w-64 transition-opacity duration-200 ease-out"
          onClick={(e) => e.stopPropagation()} // Prevent map click when clicking inside info box
        >
          <button 
            onClick={() => setClickedDistrictInfo(null)}
            className="absolute top-2 right-2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close info box"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <h3 className="font-bold text-primary text-base mb-1.5 pr-4">{clickedDistrictInfo.name}</h3>
          {clickedDistrictInfo.description && <p className="text-xs text-muted-foreground mb-2.5 line-clamp-3">{clickedDistrictInfo.description}</p>}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground text-xs py-1.5 h-auto"
            onClick={() => {
              if (clickedDistrictInfo.learnMoreUrl) {
                router.push(clickedDistrictInfo.learnMoreUrl);
              }
              setClickedDistrictInfo(null);
            }}
          >
            Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
