
// Contains shared types and constants for the application.

export interface ItineraryDay {
  day: number;
  location: string;
  activities: string[]; // Changed to array of strings
  hotelRecommendations?: string[]; // Added optional field
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

// List of Nepal districts (alphabetical)
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

// Group districts by development region (or provinces if more appropriate)
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

// Define budget ranges
export const budgetRanges = {
  'budget_under_500': '< $500 USD',
  'budget_500_1000': '$500 - $1000 USD',
  'budget_1000_2000': '$1000 - $2000 USD',
  'budget_2000_3000': '$2000 - $3000 USD',
  'budget_over_3000': '> $3000 USD'
} as const;

export type BudgetRangeKey = keyof typeof budgetRanges;
export type BudgetRangeLabel = typeof budgetRanges[BudgetRangeKey];

// GeoJSON types, can be expanded or imported from @types/geojson if more detail is needed
export declare namespace GeoJSON {
  export type GeoJsonTypes = Geometry['type'] | 'Feature' | 'FeatureCollection';
  export type Bbox = [number, number, number, number] | [number, number, number, number, number, number];

  export type Position = number[]; // [longitude, latitude, ?altitude]

  export interface Geometry {
    type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon" | "GeometryCollection";
    bbox?: Bbox;
    coordinates?: any; // Varies based on geometry type
    geometries?: Geometry[]; // For GeometryCollection
  }
  export interface Point extends Geometry { type: "Point"; coordinates: Position; }
  export interface MultiPoint extends Geometry { type: "MultiPoint"; coordinates: Position[];}
  export interface LineString extends Geometry { type: "LineString"; coordinates: Position[]; }
  export interface MultiLineString extends Geometry { type: "MultiLineString"; coordinates: Position[][]; }
  export interface Polygon extends Geometry { type: "Polygon"; coordinates: Position[][]; }
  export interface MultiPolygon extends Geometry { type: "MultiPolygon"; coordinates: Position[][][]; }
  
  export interface GeometryCollection extends Geometry {
    type: "GeometryCollection";
    geometries: Geometry[];
  }

  export interface Feature<G extends Geometry | null = Geometry, P = any> {
    type: "Feature";
    geometry: G;
    id?: string | number;
    properties: P;
    bbox?: Bbox;
  }

  export interface FeatureCollection<G extends Geometry | null = Geometry, P = any> {
    type: "FeatureCollection";
    features: Array<Feature<G, P>>;
    bbox?: Bbox;
  }

  export type GeoJsonObject = Geometry | Feature | FeatureCollection;
}

// Specific types for your map components
export interface DistrictProperties {
  name: string;
  learnMoreUrl: string;
  description?: string;
  // Add any other properties you expect from your Firestore/GeoJSON
  [key: string]: any;
}

export interface DistrictFeature extends GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, DistrictProperties> {}

// Interface for the Firestore document structure for districts (used by InteractiveDistrictMap)
export interface DistrictDocument {
  name: string;
  learnMoreUrl: string;
  description?: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon; // This is the GeoJSON geometry object
  id?: string; // Firestore document ID, optional here as it's usually the key
}

// For react-simple-maps on HomepageMap
export interface ProvinceMapData { 
  id: string; // Should match a key derived from TopoJSON properties (e.g., "bagmati_province")
  name: string; // Display name (e.g., "Bagmati Province")
  population?: number;
  description?: string;
  link?: string; // URL for "Learn More"
  [key: string]: any; // Allow other properties from TopoJSON
}

export interface CityMapData {
  id: string; // e.g., "kathmandu"
  name: string; // e.g., "Kathmandu"
  coordinates: [number, number]; // [longitude, latitude]
  type: "City";
  population?: number;
  description?: string;
  link?: string;
  highlight?: boolean;
  iconUrl?: string; // Optional path to custom icon in Firebase Storage
}
    
