export interface VehicleSpec {
  year: number;
  make: string;
  model: string;
  trim: string;
}

export interface SearchParams extends VehicleSpec {
  mileage: number;
  zip: string;
  radius: number;
  yearRange: number;
  mileageRange: number;
  top: number;
  outFile: string;
  ratePerMile: number;
  apiKey: string;
}

/** Raw listing shape from MarketCheck /v2/search/car/active */
export interface RawListing {
  id: string;
  price: number;
  miles: number;
  year: number;
  make: string;
  model: string;
  trim?: string;
  city: string;
  state: string;
  dist: number;   // miles from search ZIP
  vdp_url: string;
  dealer?: { name?: string };
}

export interface MarketCheckSearchResponse {
  num_found: number;
  listings: RawListing[];
}

/** MarketCheck VIN decode response (relevant fields) */
export interface VinDecodeResponse {
  year: string;
  make: string;
  model: string;
  trim?: string;
}

export interface ScoredListing extends RawListing {
  score: number;         // 0–100
  adjustedPrice: number; // mileage-normalized price
  rank: number;
}
