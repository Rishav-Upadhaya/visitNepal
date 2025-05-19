// src/components/maps/InteractiveDistrictMap.tsx
"use client";

import type { LatLngExpression, GeoJSON as LeafletGeoJSONType, LeafletMouseEvent, Layer, PathOptions } from 'leaflet';
// CSS IMPORTS (CRUCIAL for Leaflet to work)
import 'leaflet/dist/leaflet.css'; 
// Recommended for resolving default icon issues with webpack
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'; 
import 'leaflet-defaulticon-compatibility'; 

import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase'; 
import { collection, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, XCircle, MapPin } from 'lucide-react';

// Define types for district data and hover/click info
interface DistrictProperties {
  name: string;
  learnMoreUrl: string;
  description?: string;
  // Add any other properties you expect from your GeoJSON/Firestore
  [key: string]: any; 
}

// GeoJSON Feature type specifically for districts
interface DistrictFeature extends GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, DistrictProperties> {}

// Information for the hover/click tooltip
interface TooltipInfo {
  name: string;
  description?: string;
  x: number;
  y: number;
}

// Information for the user's geolocated position
interface UserLocationInfo {
  lat: number;
  lng: number;
  name: string; // Reverse-geocoded name
}

// Helper component to adjust map view if needed (e.g., after data loads)
const ChangeView = ({ center, zoom }: { center: LatLngExpression; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
};

export function InteractiveDistrictMap() {
  const [districts, setDistricts] = useState<DistrictFeature[]>([]);
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null); // To get map container bounds for tooltip positioning

  // Fetch district GeoJSON data from Firestore
  useEffect(() => {
    const fetchDistrictsData = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'nepal_districts_features'));
        if (querySnapshot.empty) {
          setMapError("No district data found in Firestore. Please ensure 'nepal_districts_features' collection exists and has data.");
          setDistricts([]);
          return;
        }
        const fetchedDistricts = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const feature = data.geoJsonFeature as DistrictFeature; // Assuming this structure
          
          // Ensure properties object exists and populate required fields
          if (!feature.properties) {
            feature.properties = {} as DistrictProperties;
          }
          feature.properties.name = data.name || feature.properties.name || 'Unknown District';
          feature.properties.learnMoreUrl = data.learnMoreUrl || feature.properties.learnMoreUrl || '#';
          feature.properties.description = data.description || feature.properties.description || 'No description available.';
          
          return feature;
        });
        setDistricts(fetchedDistricts);
        setMapError(null);
      } catch (err) {
        console.error("Error fetching district data from Firestore:", err);
        setMapError("Failed to load district data. Check console for details.");
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
          // Placeholder for reverse geocoding.
          // In a real app, you would call a geocoding API here.
          // const placeName = await reverseGeocode(latitude, longitude);
          const placeName = "Your Estimated Location"; 
          setUserLocation({ lat: latitude, lng: longitude, name: placeName });
        },
        (err) => {
          console.warn(`Geolocation permission denied or error: ${err.message}`);
          // Optionally, inform the user that geolocation failed or was denied
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    }
  }, []);

  const onEachFeature = (feature: DistrictFeature, layer: Layer) => {
    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        const targetLayer = e.target as LeafletGeoJSONType;
        targetLayer.setStyle({
          weight: 2.5,
          color: 'hsl(var(--accent))', // Use accent color from theme for hover
          fillOpacity: 0.6,
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }
        setTooltipInfo({
          name: feature.properties.name,
          description: feature.properties.description,
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
        });
      },
      mousemove: (e: LeafletMouseEvent) => {
        if (tooltipInfo) {
           setTooltipInfo(prev => prev ? { ...prev, x: e.originalEvent.clientX, y: e.originalEvent.clientY } : null);
        }
      },
      mouseout: (e: LeafletMouseEvent) => {
        const targetLayer = e.target as LeafletGeoJSONType;
        // Reset to default style or a specific style for GeoJSON layer
        targetLayer.setStyle(geoJsonStyle()); 
        setTooltipInfo(null);
      },
      click: () => {
        if (feature.properties.learnMoreUrl) {
          router.push(feature.properties.learnMoreUrl);
        }
      },
    });
  };

  const geoJsonStyle = (): PathOptions => ({
    fillColor: 'hsl(var(--primary) / 0.1)', // Semi-transparent primary color
    weight: 1,
    opacity: 1,
    color: 'hsl(var(--primary) / 0.6)',   // Primary color for borders
    fillOpacity: 0.3,
  });
  
  const highlightedGeoJsonStyle = (): PathOptions => ({
    fillColor: 'hsl(var(--accent) / 0.2)', // Semi-transparent accent color
    weight: 1.5,
    opacity: 1,
    color: 'hsl(var(--accent) / 0.8)',   // Accent color for borders
    fillOpacity: 0.4,
  });


  const initialCenter: LatLngExpression = [28.3949, 84.1240]; // Nepal's approximate center
  const initialZoom = 7;

  // Key cities to highlight
  const keyCities: UserLocationInfo[] = [
    { lat: 27.7172, lng: 85.3240, name: "Kathmandu" },
    { lat: 28.2096, lng: 83.9856, name: "Pokhara" },
    { lat: 27.4816, lng: 83.2756, name: "Lumbini" },
  ];


  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Interactive Map...</p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-destructive/10 text-destructive p-8 text-center">
        <XCircle className="h-12 w-12 mb-4" />
        <p className="text-xl font-semibold">Map Error</p>
        <p>{mapError}</p>
      </div>
    );
  }

  return (
    <div ref={mapContainerRef} className="h-screen w-screen_fixed_donot_change_this"> {/* Full screen container */}
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="bg-muted" // Theme background
      >
        <ChangeView center={initialCenter} zoom={initialZoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &amp; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png" // Theme-friendly tiles
        />
        {districts.length > 0 && (
          <GeoJSON
            key={JSON.stringify(districts)} // Force re-render if data changes
            data={districts as GeoJSON.GeoJsonObject} // Cast for react-leaflet
            style={geoJsonStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Highlight Key Cities */}
        {keyCities.map(city => (
            <Marker 
                key={city.name} 
                position={[city.lat, city.lng]}
                // Example of using a Lucide icon (can be customized further with L.divIcon for SVG)
                icon={L.divIcon({
                    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="hsl(var(--accent))" class="w-6 h-6 animate-pulse"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
                    className: 'bg-transparent border-none', // Remove default Leaflet icon styles
                    iconSize: [24, 24],
                    iconAnchor: [12, 24],
                })}
            >
            <Popup>
              <div className="p-1">
                <h3 className="font-semibold text-sm text-primary">{city.name}</h3>
                 {/* Add link if you have city-specific pages */}
                 {/* <a href={`/cities/${city.name.toLowerCase()}`} className="text-xs text-accent hover:underline">Learn more</a> */}
              </div>
            </Popup>
          </Marker>
        ))}

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

      {/* Hover/Click Info-box Tooltip */}
      {tooltipInfo && (
        <div
          style={{
            left: `${tooltipInfo.x + 10}px`, // Offset from cursor
            top: `${tooltipInfo.y + 10}px`,  // Offset from cursor
          }}
          className="fixed p-3 bg-background text-foreground rounded-md shadow-lg border border-border text-sm z-[1000] pointer-events-none max-w-[250px] transition-all duration-100 ease-out transform"
        >
          <h3 className="font-bold text-primary text-base mb-1">{tooltipInfo.name}</h3>
          {tooltipInfo.description && <p className="text-xs text-muted-foreground line-clamp-3">{tooltipInfo.description}</p>}
        </div>
      )}
    </div>
  );
}
