
// src/components/maps/InteractiveDistrictMap.tsx
"use client";

import type { LatLngExpression, GeoJSON as LeafletGeoJSONType, LeafletMouseEvent, Layer, PathOptions } from 'leaflet';
// CSS IMPORTS (CRUCIAL for Leaflet to work)
import 'leaflet/dist/leaflet.css'; 
// Recommended for resolving default icon issues with webpack
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'; 
import 'leaflet-defaulticon-compatibility'; 

import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, XCircle, MapPin, InfoIcon, ExternalLink, XIcon } from 'lucide-react';
import type { DistrictFeature, DistrictProperties, GeoJSON as LocalGeoJSON } from '@/types'; // Using local GeoJSON types
import { Button } from '@/components/ui/button'; // For "Learn More" button styling

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

// Helper component to adjust map view if needed (e.g., after data loads)
const ChangeView = ({ center, zoom }: { center: LatLngExpression; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
};

export function InteractiveDistrictMap() {
  const [districtFeatureCollection, setDistrictFeatureCollection] = useState<LocalGeoJSON.FeatureCollection<LocalGeoJSON.Geometry, DistrictProperties> | null>(null);
  const [clickedDistrictInfo, setClickedDistrictInfo] = useState<ClickedDistrictInfo | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null);


  // Fetch district GeoJSON data from Firestore
  useEffect(() => {
    const fetchDistrictsData = async () => {
      setLoading(true);
      setMapError(null);
      try {
        const querySnapshot = await getDocs(collection(db, 'districts'));
        if (querySnapshot.empty) {
          setMapError("No district data found in Firestore. Please ensure 'districts' collection exists and has data (name, learnMoreUrl, geometry fields).");
          setDistrictFeatureCollection(null);
          return;
        }
        
        const features: DistrictFeature[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          // Construct a valid GeoJSON Feature
          return {
            type: "Feature",
            properties: {
              name: data.name || 'Unknown District',
              learnMoreUrl: data.learnMoreUrl || '#',
              description: data.description || 'No description available.',
              // Add any other properties you expect
            },
            geometry: data.geometry as LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon // Assert the type of geometry
          };
        });

        const featureCollection: LocalGeoJSON.FeatureCollection<LocalGeoJSON.Geometry, DistrictProperties> = {
          type: "FeatureCollection",
          features: features,
        };
        
        setDistrictFeatureCollection(featureCollection);

      } catch (err) {
        console.error("Error fetching district data from Firestore:", err);
        setMapError(`Failed to load district data. ${err instanceof Error ? err.message : 'Unknown error'}. Check console for details.`);
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
          const placeName = "Your Estimated Location"; 
          setUserLocation({ lat: latitude, lng: longitude, name: placeName });
        },
        (err) => {
          console.warn(`Geolocation permission denied or error: ${err.message}`);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    }
  }, []);

  const onEachFeature = useCallback((feature: DistrictFeature, layer: Layer) => {
    layer.on({
      click: (e: LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e); // Stop event from bubbling to map click
        setClickedDistrictInfo({
          name: feature.properties.name,
          description: feature.properties.description,
          learnMoreUrl: feature.properties.learnMoreUrl,
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
        });
      },
    });
  }, [router]); // router added as dependency if learnMoreUrl navigation stays within this handler

  const handleMapClick = useCallback(() => {
    // This function will be called when clicking on the map itself (not on a feature)
    // We can use this to close the info box if desired, but the requirement is
    // "Keeps the box visible until the user clicks outside the polygon."
    // The 'X' button provides explicit closing.
    // If we want map click to close it:
    // setClickedDistrictInfo(null); 
  }, []);


  const geoJsonStyle = (): PathOptions => ({
    fillColor: 'hsl(var(--primary) / 0.2)', // Semi-transparent primary color
    weight: 1,
    opacity: 1,
    color: 'hsl(var(--primary) / 0.7)',   // Primary color for borders
    fillOpacity: 0.3,
  });
  
  const initialCenter: LatLngExpression = [28.3949, 84.1240]; // Nepal's approximate center
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
        <XCircle className="h-12 w-12 mb-4" />
        <p className="text-xl font-semibold">Map Error</p>
        <p>{mapError}</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen_fixed_donot_change_this"> {/* Full screen container */}
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="bg-muted" // Theme background
        whenCreated={mapInstance => { mapRef.current = mapInstance; }}
        onClick={handleMapClick} // Handle clicks on the map itself
      >
        <ChangeView center={initialCenter} zoom={initialZoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &amp; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png" // Theme-friendly tiles
        />
        {districtFeatureCollection && districtFeatureCollection.features.length > 0 && (
          <GeoJSON
            key={JSON.stringify(districtFeatureCollection)} // Force re-render if data changes
            data={districtFeatureCollection} 
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

      {/* Click Info-box Tooltip */}
      {clickedDistrictInfo && (
        <div
          style={{
            left: `${clickedDistrictInfo.x + 15}px`, // Offset from cursor
            top: `${clickedDistrictInfo.y + 15}px`,  // Offset from cursor
          }}
          className="fixed p-4 bg-background text-foreground rounded-lg shadow-xl border border-border text-sm z-[1001] w-64 transition-opacity duration-200 ease-out"
          // onClick={(e) => e.stopPropagation()} // Prevent map click when clicking inside info box
        >
          <button 
            onClick={() => setClickedDistrictInfo(null)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close info box"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <h3 className="font-bold text-primary text-base mb-1.5">{clickedDistrictInfo.name}</h3>
          {clickedDistrictInfo.description && <p className="text-xs text-muted-foreground mb-2.5 line-clamp-3">{clickedDistrictInfo.description}</p>}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full border-accent text-accent hover:bg-accent/10 hover:text-accent-foreground"
            onClick={() => {
              if (clickedDistrictInfo.learnMoreUrl) {
                router.push(clickedDistrictInfo.learnMoreUrl);
              }
              setClickedDistrictInfo(null); // Close info box on navigation
            }}
          >
            Learn More <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

    