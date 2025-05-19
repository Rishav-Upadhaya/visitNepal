
// src/components/maps/InteractiveDistrictMap.tsx
"use client";

import type { LatLngExpression, LeafletMouseEvent, Layer, PathOptions } from 'leaflet';
// CSS IMPORTS (CRUCIAL for Leaflet to work)
import 'leaflet/dist/leaflet.css'; 
// Recommended for resolving default icon issues with webpack
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'; 
import 'leaflet-defaulticon-compatibility'; 

import L from 'leaflet'; // Import L for custom icons or other Leaflet specifics if needed
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, InfoIcon, ExternalLink, XIcon, LocateFixed } from 'lucide-react';
import type { DistrictProperties, GeoJSON as LocalGeoJSON } from '@/types';
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
  const mapRef = useRef<L.Map | null>(null); // To control map instance

  // Fetch district data from Firestore
  useEffect(() => {
    const fetchDistrictsData = async () => {
      setLoading(true);
      setMapError(null);
      try {
        const querySnapshot = await getDocs(collection(db, 'districts'));
        if (querySnapshot.empty) {
          setMapError("No district data found in Firestore 'districts' collection. Please ensure data is populated.");
          setDistrictFeatureCollection(null);
          setLoading(false);
          return;
        }
        
        const features: LocalGeoJSON.Feature<LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon, DistrictProperties>[] = querySnapshot.docs.map(doc => {
          const data = doc.data() as Partial<DistrictProperties & { geometry: LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon }>;
          if (!data.geometry || !data.name || !data.learnMoreUrl) {
            console.warn(`Skipping district document ${doc.id} due to missing critical fields (name, learnMoreUrl, or geometry).`);
            return null; 
          }
          return {
            type: "Feature",
            properties: {
              name: data.name,
              learnMoreUrl: data.learnMoreUrl,
              description: data.description || `Learn more about ${data.name}.`,
            },
            geometry: data.geometry,
            id: doc.id,
          };
        }).filter(feature => feature !== null) as LocalGeoJSON.Feature<LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon, DistrictProperties>[];

        if (features.length === 0) {
          setMapError("No valid district features could be constructed. Check Firestore data (collection 'districts') and console warnings.");
          setDistrictFeatureCollection(null);
        } else {
           setDistrictFeatureCollection({
            type: "FeatureCollection",
            features: features,
          });
        }
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

  // Optional: Get user's geolocation
  const locateUser = useCallback(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Placeholder - implement reverse geocoding for real name if needed
          const placeName = "Your Current Location"; 
          setUserLocation({ lat: latitude, lng: longitude, name: placeName });
          if (mapRef.current) {
            mapRef.current.flyTo([latitude, longitude], 13); // Zoom to user's location
          }
          // Display info for user's location
          setClickedDistrictInfo({
            name: placeName,
            description: "This is your estimated current location. Explore nearby districts!",
            learnMoreUrl: "", // No specific "learn more" for this generic location
            x: window.innerWidth / 2, // Center roughly if needed
            y: window.innerHeight / 2,
          });
        },
        (err) => {
          console.warn(`Geolocation permission denied or error: ${err.message}`);
          alert(`Could not get your location: ${err.message}`);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  }, []);
  

  const onEachFeature = useCallback((feature: LocalGeoJSON.Feature<LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon, DistrictProperties>, layer: Layer) => {
    const defaultStyle: PathOptions = {
      fillColor: 'hsl(var(--primary-foreground))', 
      weight: 1,
      opacity: 1,
      color: 'hsl(var(--border))', 
      fillOpacity: 0.4,
    };
    const hoverStyle: PathOptions = { 
      fillOpacity: 0.6,
      weight: 2,
      color: 'hsl(var(--accent))'
    };

    (layer as L.Path).setStyle(defaultStyle);

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        (e.target as L.Path).setStyle(hoverStyle);
        if (L.Browser.mobile) return; // Do not show hover tooltip on mobile, rely on click
      },
      mouseout: (e: LeafletMouseEvent) => {
        (e.target as L.Path).setStyle(defaultStyle);
      },
      click: (e: LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e); 
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
  }, []); 

  const geoJsonStyle = (): PathOptions => ({ 
    fillColor: 'hsl(var(--primary-foreground))',
    weight: 1,
    opacity: 1,
    color: 'hsl(var(--border))', 
    fillOpacity: 0.4,
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
    <div className="h-screen w-screen_fixed_donot_change_this relative">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="bg-muted"
        whenCreated={mapInstance => { mapRef.current = mapInstance; }}
        onClick={() => setClickedDistrictInfo(null)} 
      >
        <ChangeView center={initialCenter} zoom={initialZoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &amp; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
        />
        {districtFeatureCollection && districtFeatureCollection.features.length > 0 && (
          <GeoJSON
            key={JSON.stringify(districtFeatureCollection)} 
            data={districtFeatureCollection as LocalGeoJSON.GeoJsonObject} 
            style={geoJsonStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>
              <div className="p-2 bg-background rounded-md shadow-lg border border-border">
                <h3 className="font-semibold text-sm text-primary mb-1">
                  {userLocation.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  (Estimated)
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Info-box for Clicked District */}
      {clickedDistrictInfo && (
        <div
          style={{
            position: 'fixed',
            left: `${clickedDistrictInfo.x + 15}px`, 
            top: `${clickedDistrictInfo.y + 15}px`,  
            transform: clickedDistrictInfo.x > window.innerWidth - 270 ? 'translateX(-100%) translateX(-30px)' : 'none',
          }}
          className="p-4 bg-background text-foreground rounded-lg shadow-xl border border-border text-sm z-[1001] w-64 transition-all duration-150 ease-out"
          onClick={(e) => e.stopPropagation()} 
        >
          <button 
            onClick={() => setClickedDistrictInfo(null)}
            className="absolute top-2 right-2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close info box"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <h3 className="font-bold text-primary text-base mb-1 pr-4">{clickedDistrictInfo.name}</h3>
          {clickedDistrictInfo.description && <p className="text-xs text-muted-foreground mb-2.5 line-clamp-3">{clickedDistrictInfo.description}</p>}
          {clickedDistrictInfo.learnMoreUrl && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-accent border-accent hover:bg-accent/10 hover:text-accent-foreground text-xs py-1.5 h-auto mt-2"
              onClick={() => {
                router.push(clickedDistrictInfo.learnMoreUrl);
                setClickedDistrictInfo(null); 
              }}
            >
              Learn More <ExternalLink className="ml-1.5 h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
