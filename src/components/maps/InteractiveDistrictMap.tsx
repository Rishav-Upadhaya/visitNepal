
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
import { Loader2, InfoIcon, ExternalLink, XIcon } from 'lucide-react';
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
  // User location state and related logic removed
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null); 

  // Fetch district data from Firestore
  useEffect(() => {
    const fetchDistrictsData = async () => {
      setLoading(true);
      setMapError(null);
      try {
        const querySnapshot = await getDocs(collection(db, 'districts'));
        if (querySnapshot.empty) {
          setMapError("No district data found. Please ensure the 'districts' collection in Firestore is populated with GeoJSON features.");
          setDistrictFeatureCollection(null);
          setLoading(false);
          return;
        }
        
        const features: LocalGeoJSON.Feature<LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon, DistrictProperties>[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          // Ensure critical fields exist
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
            geometry: data.geometry as LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon, // Cast geometry
            id: doc.id, // Use Firestore document ID as feature ID
          };
        }).filter(feature => feature !== null) as LocalGeoJSON.Feature<LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon, DistrictProperties>[];

        if (features.length === 0) {
          setMapError("No valid district features could be constructed. Check Firestore data and console warnings.");
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
        if (L.Browser.mobile) return; 
      },
      mouseout: (e: LeafletMouseEvent) => {
        (e.target as L.Path).setStyle(defaultStyle);
      },
      click: (e: LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e); // Important to prevent map click from closing it immediately
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
  }, [router]); // Added router to dependency array as it's used in click handler

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
    <div className="h-screen w-screen_fixed_donot_change_this relative"> {/* Ensure this div takes full screen */}
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="bg-muted"
        whenCreated={mapInstance => { mapRef.current = mapInstance; }}
        onClick={() => setClickedDistrictInfo(null)} // Close info-box if map is clicked
      >
        <ChangeView center={initialCenter} zoom={initialZoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &amp; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
        />
        {districtFeatureCollection && districtFeatureCollection.features.length > 0 && (
          <GeoJSON
            key={JSON.stringify(districtFeatureCollection)} // Force re-render if data changes
            data={districtFeatureCollection as LocalGeoJSON.GeoJsonObject} // Cast to GeoJsonObject
            style={geoJsonStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {/* User location marker removed */}
      </MapContainer>

      {/* Info-box for Clicked District */}
      {clickedDistrictInfo && (
        <div
          style={{
            position: 'fixed',
            left: `${clickedDistrictInfo.x + 15}px`, 
            top: `${clickedDistrictInfo.y + 15}px`,  
            transform: clickedDistrictInfo.x > window.innerWidth - 270 ? 'translateX(-100%) translateX(-30px)' : 'none', // Adjust if too close to edge
          }}
          className="p-4 bg-background text-foreground rounded-lg shadow-xl border border-border text-sm z-[1001] w-64 transition-opacity duration-200 ease-out"
          // Removed direct onClick here to prevent self-closing when interacting with button inside
        >
          <button 
            onClick={(e) => {
                e.stopPropagation(); // Prevent map click handler
                setClickedDistrictInfo(null);
            }}
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
              onClick={(e) => {
                e.stopPropagation(); // Prevent map click
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
