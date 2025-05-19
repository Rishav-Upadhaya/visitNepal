
// src/components/maps/InteractiveDistrictMap.tsx
"use client";

import type { LatLngExpression, LeafletMouseEvent, Layer, PathOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import 'leaflet-defaulticon-compatibility';

import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, InfoIcon, ExternalLink, XIcon } from 'lucide-react';
import type { DistrictProperties, GeoJSON as LocalGeoJSON, DistrictFeature } from '@/types';
import { Button } from '@/components/ui/button';

interface ClickedDistrictInfo {
  name: string;
  description?: string;
  learnMoreUrl: string;
  x: number; // pageX for cursor position
  y: number; // pageY for cursor position
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
  const [districtsData, setDistrictsData] = useState<LocalGeoJSON.FeatureCollection<LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon, DistrictProperties> | null>(null);
  const [clickedDistrictInfo, setClickedDistrictInfo] = useState<ClickedDistrictInfo | null>(null);
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
          setDistrictsData(null);
          setLoading(false);
          return;
        }
        
        const features: DistrictFeature[] = querySnapshot.docs.map(doc => {
          const data = doc.data() as DocumentData;
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
              // Copy any other relevant properties from Firestore doc data to feature.properties if needed
            },
            geometry: data.geometry as LocalGeoJSON.Polygon | LocalGeoJSON.MultiPolygon, // Cast geometry
            id: doc.id, // Use Firestore document ID as feature ID
          };
        }).filter(feature => feature !== null) as DistrictFeature[];

        if (features.length === 0) {
          setMapError("No valid district features could be constructed. Check Firestore data and console warnings.");
          setDistrictsData(null);
        } else {
           setDistrictsData({
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
      fillColor: 'hsl(var(--card))', // Lighter fill
      weight: 1,
      opacity: 1,
      color: 'hsl(var(--border))', 
      fillOpacity: 0.5, // Slightly more opaque default fill
    };
    const hoverStyle: PathOptions = { 
      fillColor: 'hsl(var(--accent) / 0.4)', // Use accent color with some opacity on hover
      weight: 2,
      color: 'hsl(var(--accent-foreground))', 
      fillOpacity: 0.6,
    };

    (layer as L.Path).setStyle(defaultStyle);

    // No hover tooltips/info-boxes. Only visual style change on hover.
    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        (e.target as L.Path).setStyle(hoverStyle);
        (e.target as L.Path).bringToFront();
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
          x: e.originalEvent.clientX, // Use clientX for exact cursor position
          y: e.originalEvent.clientY, // Use clientY for exact cursor position
        });
      },
    });
  }, [router]); // Added router to dependency array

  const geoJsonStyle = (): PathOptions => ({ 
    fillColor: 'hsl(var(--card))',
    weight: 1,
    opacity: 1,
    color: 'hsl(var(--border))', 
    fillOpacity: 0.5,
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

  // Optional: Geolocation logic can be re-added here if a "Locate Me" button is desired.
  // For now, it's removed to focus on district click interactions.

  return (
    <div className="h-screen w-screen relative"> {/* Ensure this div takes full screen */}
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="bg-muted" // Background for the map area itself
        whenCreated={mapInstance => { mapRef.current = mapInstance; }}
        onClick={() => setClickedDistrictInfo(null)} // Close info-box if map background is clicked
      >
        <ChangeView center={initialCenter} zoom={initialZoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &amp; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
        />
        {districtsData && districtsData.features.length > 0 && (
          <GeoJSON
            key={JSON.stringify(districtsData)} 
            data={districtsData as LocalGeoJSON.GeoJsonObject}
            style={geoJsonStyle}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* Info-box for Clicked District */}
      {clickedDistrictInfo && (
        <div
          style={{
            position: 'fixed',
            left: `${clickedDistrictInfo.x}px`, // Exact cursor X
            top: `${clickedDistrictInfo.y}px`,  // Exact cursor Y
            // Optional: Add transform to shift if too close to edge, or let it overflow
            // transform: clickedDistrictInfo.x > window.innerWidth - 270 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
            // transform: `translate(${clickedDistrictInfo.x + 10}px, ${clickedDistrictInfo.y + 10}px)` // Example with offset
          }}
          className="p-4 bg-background text-foreground rounded-lg shadow-xl border border-border text-sm z-[1001] w-64 transition-opacity duration-200 ease-out"
          onClick={(e) => e.stopPropagation()} // Prevent map click handler from closing it
        >
          <button 
            onClick={() => setClickedDistrictInfo(null)}
            className="absolute top-2 right-2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close info box"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <h3 className="font-bold text-primary text-base mb-1 pr-4">{clickedDistrictInfo.name}</h3>
          {/* {clickedDistrictInfo.description && <p className="text-xs text-muted-foreground mb-2.5 line-clamp-3">{clickedDistrictInfo.description}</p>} */}
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

