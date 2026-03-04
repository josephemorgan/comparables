import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { decodeVin, searchInventory } from './api.js';
import type { SearchParams } from './types.js';

vi.mock('axios');
const mockedGet = vi.mocked(axios.get);

const params: SearchParams = {
  year: 2019,
  make: 'Honda',
  model: 'Accord',
  trim: 'EX-L',
  mileage: 55000,
  zip: '90210',
  radius: 100,
  yearRange: 1,
  mileageRange: 25000,
  top: 10,
  outFile: 'comparables.csv',
  ratePerMile: 0.10,
  apiKey: 'test-key',
};

describe('decodeVin', () => {
  it('returns parsed VehicleSpec from MarketCheck response', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { year: '2019', make: 'Honda', model: 'Accord', trim: 'EX-L' },
    });

    const result = await decodeVin('1HGCV1F30KA123456', 'test-key');

    expect(mockedGet).toHaveBeenCalledWith(
      'https://mc-api.marketcheck.com/v2/decode/car/1HGCV1F30KA123456/specs',
      { params: { api_key: 'test-key' } },
    );
    expect(result).toEqual({ year: 2019, make: 'Honda', model: 'Accord', trim: 'EX-L' });
  });

  it('throws a descriptive error if VIN is not found (404)', async () => {
    mockedGet.mockRejectedValueOnce({ response: { status: 404, data: { message: 'Not found' } } });
    await expect(decodeVin('BADINPUT', 'test-key')).rejects.toThrow('VIN not found');
  });
});

describe('searchInventory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls MarketCheck with correct query params and returns listings', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        num_found: 1,
        listings: [
          {
            id: 'abc',
            price: 24500,
            miles: 52000,
            year: 2019,
            make: 'Honda',
            model: 'Accord',
            trim: 'EX-L',
            city: 'Santa Monica',
            state: 'CA',
            dist: 5.1,
            vdp_url: 'https://example.com/abc',
          },
        ],
      },
    });

    const result = await searchInventory(params);

    expect(mockedGet).toHaveBeenCalledWith(
      'https://mc-api.marketcheck.com/v2/search/car/active',
      expect.objectContaining({
        params: expect.objectContaining({
          api_key: 'test-key',
          year: '2018,2019,2020',
          make: 'Honda',
          model: 'Accord',
          zip: '90210',
          radius: 100,
          mileage_above: 30000,
          mileage_below: 80000,
          rows: 50,
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(24500);
  });

  it('throws if API returns an error', async () => {
    mockedGet.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });
    await expect(searchInventory(params)).rejects.toThrow('MarketCheck API error 401');
  });
});
