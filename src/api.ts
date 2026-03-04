import axios from 'axios';
import type { VehicleSpec, RawListing, SearchParams, MarketCheckSearchResponse, VinDecodeResponse } from './types.js';

const BASE = 'https://mc-api.marketcheck.com/v2';

export async function decodeVin(vin: string, apiKey: string): Promise<VehicleSpec> {
  try {
    const { data } = await axios.get<VinDecodeResponse>(
      `${BASE}/decode/car/${vin}/specs`,
      { params: { api_key: apiKey } },
    );
    return {
      year: parseInt(data.year, 10),
      make: data.make,
      model: data.model,
      trim: data.trim ?? '',
    };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 404) throw new Error(`VIN not found: ${vin}`);
    throw new Error(`MarketCheck API error ${status ?? 'unknown'} decoding VIN`);
  }
}

export async function searchInventory(params: SearchParams): Promise<RawListing[]> {
  const yearMin = params.year - params.yearRange;
  const yearMax = params.year + params.yearRange;
  const years = Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i).join(',');

  try {
    const { data } = await axios.get<MarketCheckSearchResponse>(
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
    return data.listings ?? [];
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status;
    const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
    throw new Error(`MarketCheck API error ${status ?? 'unknown'}: ${message ?? 'unknown error'}`);
  }
}
