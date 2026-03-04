import { describe, it, expect } from 'vitest';
import { computeScore, applyMileageAdjustment, rankListings } from './score.js';
import type { RawListing, SearchParams } from './types.js';

const baseParams: SearchParams = {
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
  apiKey: 'test',
};

const baseListing: RawListing = {
  id: '1',
  price: 24000,
  miles: 55000,
  year: 2019,
  make: 'Honda',
  model: 'Accord',
  trim: 'EX-L',
  city: 'Los Angeles',
  state: 'CA',
  dist: 0,
  vdp_url: 'https://example.com/1',
};

describe('computeScore', () => {
  it('returns 100 for a perfect match (0 dist, 0 mileage delta, exact trim)', () => {
    const score = computeScore(baseListing, baseParams);
    expect(score).toBe(100);
  });

  it('returns 60 for a listing at max radius with same mileage and exact trim', () => {
    const listing = { ...baseListing, dist: 100 };
    const score = computeScore(listing, baseParams);
    expect(score).toBe(60); // 0 dist pts + 40 mileage pts + 20 trim pts
  });

  it('returns 60 for a listing with max mileage delta but 0 dist and exact trim', () => {
    const listing = { ...baseListing, miles: 55000 + 25000 };
    const score = computeScore(listing, baseParams);
    expect(score).toBe(60); // 40 dist pts + 0 mileage pts + 20 trim pts
  });

  it('gives 10 trim points for partial trim match', () => {
    const listing = { ...baseListing, trim: 'EX-L w/Honda Sensing' };
    const score = computeScore(listing, baseParams);
    expect(score).toBe(90); // 40 + 40 + 10
  });

  it('gives 0 trim points for no trim match', () => {
    const listing = { ...baseListing, trim: 'Sport' };
    const score = computeScore(listing, baseParams);
    expect(score).toBe(80); // 40 + 40 + 0
  });

  it('gives 0 trim points for a listing with no trim data', () => {
    const listing = { ...baseListing, trim: undefined };
    const score = computeScore(listing, baseParams);
    expect(score).toBe(80); // 40 dist + 40 mileage + 0 trim (no trim data)
  });

  it('handles mileageRange: 0 without NaN (exact mileage match = max points)', () => {
    const params = { ...baseParams, mileageRange: 0 };
    const score = computeScore(baseListing, params); // baseListing.miles === baseParams.mileage
    expect(Number.isNaN(score)).toBe(false);
    expect(score).toBe(100);
  });

  it('handles mileageRange: 0 without NaN (different mileage = 0 pts)', () => {
    const params = { ...baseParams, mileageRange: 0 };
    const listing = { ...baseListing, miles: 60000 };
    const score = computeScore(listing, params);
    expect(Number.isNaN(score)).toBe(false);
    expect(score).toBe(60); // 40 dist + 0 mileage + 20 trim
  });
});

describe('applyMileageAdjustment', () => {
  it('lowers adjusted price when comp has more miles than subject', () => {
    // comp has 65k miles, subject has 55k → 10k extra miles
    // comp is worth less at those miles, so adjusted price is lower
    // adjusted = 24000 - (65000 - 55000) * 0.10 = 24000 - 1000 = 23000
    const adjusted = applyMileageAdjustment(24000, 65000, 55000, 0.10);
    expect(adjusted).toBe(23000);
  });

  it('raises adjusted price when comp has fewer miles than subject', () => {
    // comp has 45k miles, subject has 55k → -10k delta
    // comp is worth more at fewer miles, so adjusted price is higher
    // adjusted = 24000 - (45000 - 55000) * 0.10 = 24000 + 1000 = 25000
    const adjusted = applyMileageAdjustment(24000, 45000, 55000, 0.10);
    expect(adjusted).toBe(25000);
  });

  it('returns same price when mileage is equal', () => {
    const adjusted = applyMileageAdjustment(24000, 55000, 55000, 0.10);
    expect(adjusted).toBe(24000);
  });
});

describe('rankListings', () => {
  it('sorts listings by score descending and assigns rank', () => {
    const listings: RawListing[] = [
      { ...baseListing, id: 'a', dist: 50, miles: 55000 },  // mid score
      { ...baseListing, id: 'b', dist: 0, miles: 55000 },   // high score
      { ...baseListing, id: 'c', dist: 100, miles: 80000 }, // low score
    ];
    const ranked = rankListings(listings, baseParams);
    expect(ranked[0].id).toBe('b');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].adjustedPrice).toBe(24000);
    expect(ranked[1].id).toBe('a');
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].id).toBe('c');
    expect(ranked[2].rank).toBe(3);
  });
});
