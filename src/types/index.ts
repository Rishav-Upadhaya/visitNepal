
// Contains shared types and constants for the application.
import type { Topology, Objects, GeometryCollection, Geometry } from 'topojson-client';

export interface ItineraryDay {
  day: number;
  location: string;
  activities: string[];
  hotelRecommendations?: string[];
}

export interface Itinerary {
  itinerary: ItineraryDay[];
}

export interface HiddenGemSuggestion {
  hiddenGems: string[];
}

export interface VirtualPostcard {
  caption: string;
}

export const nepalDistricts = [
  "Achham", "Arghakhanchi", "Baglung", "Baitadi", "Bajhang", "Bajura", "Banke", "Bara",
  "Bardiya", "Bhaktapur", "Bhojpur", "Chitwan", "Dadeldhura", "Dailekh", "Dang",
  "Darchula", "Dhading", "Dhankuta", "Dhanusha", "Dolakha", "Dolpa", "Doti", "Gorkha",
  "Gulmi", "Humla", "Ilam", "Jajarkot", "Jhapa", "Jumla", "Kailali", "Kalikot",
  "Kanchanpur", "Kapilvastu", "Kaski", "Kathmandu", "Kavrepalanchok", "Khotang",
  "Lalitpur", "Lamjung", "Mahottari", "Makwanpur", "Manang", "Morang", "Mugu",
  "Mustang", "Myagdi", "Nawalparasi East", "Nawalparasi West", "Nuwakot", "Okhaldhunga", "Palpa",
  "Panchthar", "Parbat", "Parsa", "Pyuthan", "Ramechhap", "Rasuwa", "Rautahat",
  "Rolpa", "Rukum East", "Rukum West", "Rupandehi", "Salyan", "Sankhuwasabha", "Saptari",
  "Sarlahi", "Sindhuli", "Sindhupalchok", "Siraha", "Solukhumbu", "Sunsari", "Surkhet",
  "Syangja", "Tanahun", "Taplejung", "Terhathum", "Udayapur",
] as const;

export type DistrictName = typeof nepalDistricts[number];

export const nepalDistrictsByRegion = {
  "East Nepal (Koshi Province)": [
    "Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", "Okhaldhunga",
    "Panchthar", "Sankhuwasabha", "Solukhumbu", "Sunsari", "Taplejung", "Terhathum", "Udayapur"
  ],
  "Central Nepal (Madhesh Province)": [
    "Bara", "Dhanusha", "Mahottari", "Parsa", "Rautahat", "Saptari", "Sarlahi", "Siraha"
  ],
  "Central Nepal (Bagmati Province)": [
    "Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu", "Kavrepalanchok", "Lalitpur",
    "Makwanpur", "Nuwakot", "Ramechhap", "Rasuwa", "Sindhuli", "Sindhupalchok"
  ],
  "West Nepal (Gandaki Province)": [
    "Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", "Mustang", "Myagdi", "Nawalparasi East",
    "Parbat", "Syangja", "Tanahun"
  ],
  "West Nepal (Lumbini Province)": [
    "Arghakhanchi", "Banke", "Bardiya", "Dang", "Gulmi", "Kapilvastu", "Nawalparasi West",
    "Palpa", "Pyuthan", "Rolpa", "Rukum East", "Rupandehi"
  ],
  "Mid-West Nepal (Karnali Province)": [
    "Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla", "Kalikot", "Mugu",
    "Rukum West", "Salyan", "Surkhet"
  ],
  "Far-West Nepal (Sudurpashchim Province)": [
    "Achham", "Baitadi", "Bajhang", "Bajura", "Dadeldhura", "Darchula", "Doti",
    "Kailali", "Kanchanpur"
  ]
} as const;

export type RegionName = keyof typeof nepalDistrictsByRegion;

export const budgetRanges = {
  'budget_under_500': '< $500 USD',
  'budget_500_1000': '$500 - $1000 USD',
  'budget_1000_2000': '$1000 - $2000 USD',
  'budget_2000_3000': '$2000 - $3000 USD',
  'budget_over_3000': '> $3000 USD'
} as const;

export type BudgetRangeKey = keyof typeof budgetRanges;
export type BudgetRangeLabel = typeof budgetRanges[BudgetRangeKey];

// GeoJSON types (simplified for use with react-simple-maps and our data)
export declare namespace GeoJSON {
  export type GeoJsonTypes = "FeatureCollection" | "Feature" | "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon" | "GeometryCollection";
  export type Bbox = [number, number, number, number] | [number, number, number, number, number, number];
  export type Position = number[]; // [longitude, latitude, ?altitude]

  export interface GeoJsonObject { type: GeoJsonTypes; bbox?: Bbox; }
  export interface GeometryObject extends GeoJsonObject { }
  export interface Point extends GeometryObject { type: "Point"; coordinates: Position; }
  export interface MultiPoint extends GeometryObject { type: "MultiPoint"; coordinates: Position[]; }
  export interface LineString extends GeometryObject { type: "LineString"; coordinates: Position[]; }
  export interface MultiLineString extends GeometryObject { type: "MultiLineString"; coordinates: Position[][]; }
  export interface Polygon extends GeometryObject { type: "Polygon"; coordinates: Position[][]; }
  export interface MultiPolygon extends GeometryObject { type: "MultiPolygon"; coordinates: Position[][][]; }
  export interface GeometryCollection extends GeometryObject { type: "GeometryCollection"; geometries: Array<Geometry>; }
  export type Geometry = Point | MultiPoint | LineString | MultiLineString | Polygon | MultiPolygon | GeometryCollection;

  export interface Feature<G extends Geometry | null = Geometry, P = any> extends GeoJsonObject {
    type: "Feature";
    geometry: G;
    id?: string | number;
    properties: P;
  }
  export interface FeatureCollection<G extends Geometry | null = Geometry, P = any> extends GeoJsonObject {
    type: "FeatureCollection";
    features: Array<Feature<G, P>>;
  }
}

// For Leaflet map (InteractiveDistrictMap)
export interface DistrictProperties {
  name: string;
  learnMoreUrl: string;
  description?: string;
  id?: string | number; // Optional, can be derived from Firestore doc ID
  [key: string]: any; // Allow other properties
}
export interface DistrictFeature extends GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, DistrictProperties> {}


// For HomepageMap (react-simple-maps)
export interface ExtendedFeatureProperties {
  id: string; // Should be unique (e.g., rsmKey or derived unique ID)
  name: string;
  type: 'District' | 'City';
  description?: string; // This can be the initial description from TopoJSON/majorCities
  population?: number;
  link?: string;
  originalProperties?: any; // Store original TopoJSON properties if needed
  // Coordinates only for cities, districts get it from geometry
  coordinates?: [number, number];
}

// Represents a GeoJSON feature after TopoJSON conversion for react-simple-maps
export interface ExtendedFeature extends GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, ExtendedFeatureProperties> {
  rsmKey?: string; // react-simple-maps adds this
}

export interface HomepageMapProps {
  initialMapData?: Topology | null;
}
export interface ProvinceMapData { // Used as base for info box, data primarily from TopoJSON properties initially
  id: string;
  name: string;
  type: 'District'; // Changed from Province to District
  description?: string;
  population?: number;
  link?: string;
  originalProperties?: any;
}

export interface CityMapData { // Used for majorCities array and info box
  id: string;
  name: string;
  type: 'City';
  coordinates: [number, number];
  population?: number;
  description?: string;
  link?: string;
  highlight?: boolean;
  iconUrl?: string;
}

// Union type for selected features in HomepageMap info box, now more detailed
export type SelectedFeatureDetails = {
  id: string;
  name: string;
  type: 'District' | 'City';
  link?: string;
  // Details fetched on demand
  population?: number | null;
  description?: string | null; // Description from Firestore
  aiDescription?: string | null; // AI-generated description
  originalProperties?: any; // Original properties from TopoJSON or city data
};
