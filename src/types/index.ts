// Contains shared types and constants for the application.

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

// GeoJSON types from @types/geojson
export type GeoJsonGeometryTypes = GeoJSON.Geometry['type'];
export type Bbox = [number, number, number, number] | [number, number, number, number, number, number];
export type Position = number[]; // [longitude, latitude, ?altitude]

export interface Geometry {
  type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon" | "GeometryCollection";
  bbox?: Bbox;
  coordinates?: any;
  geometries?: Geometry[];
}
export interface Point extends Geometry { type: "Point"; coordinates: Position; }
export interface MultiPoint extends Geometry { type: "MultiPoint"; coordinates: Position[];}
export interface LineString extends Geometry { type: "LineString"; coordinates: Position[]; }
export interface MultiLineString extends Geometry { type: "MultiLineString"; coordinates: Position[][]; }
export interface Polygon extends Geometry { type: "Polygon"; coordinates: Position[][]; }
export interface MultiPolygon extends Geometry { type: "MultiPolygon"; coordinates: Position[][][]; }

export interface GeometryCollection extends Geometry {
  type: "GeometryCollection";
  geometries: Array<Geometry>;
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


// Specific types for your map components
export interface DistrictProperties { // General properties for a district/province feature
  name: string;
  learnMoreUrl: string;
  description?: string;
  id?: string | number;
  [key: string]: any;
}

// Type for features used in HomepageMap (derived from TopoJSON)
export interface ExtendedFeature extends Feature<Polygon | MultiPolygon, any> {
  properties: {
    id: string;
    name: string;
    type: 'District' | 'City';
    description?: string;
    population?: number;
    link?: string;
    [key: string]: any;
  };
  rsmKey?: string;
}


// For HomepageMap - Data shape for individual provinces/districts
export interface ProvinceMapData { // This is used in the majorCities array in HomepageMap.tsx
  id: string;
  name: string;
  type: 'District';
  population?: number;
  description?: string;
  link?: string;
  properties?: any; // Original properties from TopoJSON/GeoJSON can be stored here
}

// For HomepageMap - Data shape for individual cities
export interface CityMapData {
  id: string;
  name: string;
  type: 'City';
  coordinates: [number, number];
  population?: number;
  description?: string;
  link?: string;
  highlight?: boolean;
  iconUrl?: string; // Not currently used, but placeholder for custom icons
}

// Union type for selected features in HomepageMap info box
export type ExtendedProperties = ProvinceMapData | CityMapData;


// For InteractiveDistrictMap (Leaflet)
export interface InteractiveMapDistrictProperties {
  name: string;
  learnMoreUrl: string;
  description?: string;
  // Add any other properties you expect from your Firestore GeoJSON Feature
  [key: string]: any;
}

export interface InteractiveMapFeature extends Feature<Polygon | MultiPolygon, InteractiveMapDistrictProperties> {}

export interface InteractiveMapFeatureCollection extends FeatureCollection<Polygon | MultiPolygon, InteractiveMapDistrictProperties> {}

