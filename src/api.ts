import axios from 'axios';
import type { VehicleSpec, RawListing, SearchParams, VinDecodeResponse } from './types.js';

/** Actual shape returned by MarketCheck /v2/search/car/active listings array */
interface MCListing {
  id: string;
  price?: number;
  miles?: number;
  dist?: number;
  vdp_url?: string;
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
  };
  dealer?: {
    name?: string;
    city?: string;
    state?: string;
  };
}

interface MCSearchResponse {
  num_found: number;
  listings: MCListing[];
}

const BASE = 'https://mc-api.marketcheck.com/v2';

export async function decodeVin(vin: string, apiKey: string): Promise<VehicleSpec> {
  try {
    const { data } = await axios.get<VinDecodeResponse>(
      `${BASE}/decode/car/${vin}/specs`,
      { params: { api_key: apiKey } },
    );
    const year = parseInt(data.year, 10);
    if (isNaN(year)) throw new Error(`MarketCheck returned invalid year: "${data.year}"`);
    return { year, make: data.make, model: data.model, trim: data.trim ?? '' };
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 404) throw new Error(`VIN not found: ${vin}`);
      throw new Error(`MarketCheck API error ${status ?? 'unknown'} decoding VIN`);
    }
    throw err;
  }
}

export async function searchInventory(params: SearchParams): Promise<RawListing[]> {
  const yearMin = params.year - params.yearRange;
  const yearMax = params.year + params.yearRange;
  const years = Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i).join(',');

  try {
    const { data } = await axios.get<MCSearchResponse>(
      `${BASE}/search/car/active`,
      {
        params: {
          api_key: params.apiKey,
          year: years,
          make: params.make,
          model: params.model,
          ...(params.trim ? { trim: params.trim } : {}),
          zip: params.zip,
          radius: params.radius,
          mileage_above: Math.max(0, params.mileage - params.mileageRange),
          mileage_below: params.mileage + params.mileageRange,
          rows: 50,
          start: 0,
        },
      },
    );
    // Flatten nested build/dealer fields into our RawListing shape
    return (data.listings ?? []).map((l): RawListing => ({
      id: l.id,
      price: l.price,
      miles: l.miles,
      dist: l.dist,
      vdp_url: l.vdp_url,
      year: l.build?.year ?? 0,
      make: l.build?.make ?? '',
      model: l.build?.model ?? '',
      trim: l.build?.trim,
      city: l.dealer?.city ?? '',
      state: l.dealer?.state ?? '',
      dealer: l.dealer,
    }));
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const message = err.response?.data?.message as string | undefined;
      if (status === 404) throw new Error(`MarketCheck search endpoint not found (404) — check API version`);
      throw new Error(`MarketCheck API error ${status ?? 'unknown'}: ${message ?? 'unknown error'}`);
    }
    throw err;
  }
}
