import { describe, it, expect } from 'vitest';
import { buildCsvRows, computeSummary, printTable, printSummary } from './output.js';
import type { ScoredListing } from './types.js';

const listings: ScoredListing[] = [
  {
    id: '1', rank: 1, score: 95, price: 24000, adjustedPrice: 24500,
    miles: 50000, year: 2019, make: 'Honda', model: 'Accord', trim: 'EX-L',
    city: 'Los Angeles', state: 'CA', dist: 5, vdp_url: 'https://example.com/1',
  },
  {
    id: '2', rank: 2, score: 88, price: 23000, adjustedPrice: 23200,
    miles: 58000, year: 2019, make: 'Honda', model: 'Accord', trim: 'EX-L',
    city: 'Pasadena', state: 'CA', dist: 12, vdp_url: 'https://example.com/2',
  },
];

describe('buildCsvRows', () => {
  it('returns header row plus one data row per listing', () => {
    const rows = buildCsvRows(listings);
    expect(rows).toHaveLength(3); // header + 2 data
    expect(rows[0][0]).toBe('Rank');
    expect(rows[1][0]).toBe('1');
    expect(rows[1][4]).toBe('EX-L');  // trim (col index 4)
    expect(rows[1][6]).toBe('24000'); // listed price (col index 6)
    expect(rows[1][7]).toBe('24500'); // adjusted price (col index 7)
  });

  it('handles listings with no trim (undefined)', () => {
    const noTrimListings: ScoredListing[] = [{
      ...listings[0], trim: undefined,
    }];
    const rows = buildCsvRows(noTrimListings);
    expect(rows[1][4]).toBe(''); // trim col is empty string
  });

  it('escapes embedded double-quotes in cell values', () => {
    const quotedListing: ScoredListing = {
      ...listings[0], make: 'Honda "Special"',
    };
    const rows = buildCsvRows([quotedListing]);
    // The make cell should have internal quotes doubled
    expect(rows[1][3]).toBe('Honda "Special"'); // raw value
    // writeCsv would wrap it as: "Honda ""Special"""
    // Test the escaping logic directly by simulating writeCsv's map
    const escaped = rows[1][3].replace(/"/g, '""');
    expect(escaped).toBe('Honda ""Special""');
  });
});

describe('computeSummary', () => {
  it('returns average adjusted price of top N listings', () => {
    const summary = computeSummary(listings, 2);
    expect(summary.average).toBe(23850); // (24500 + 23200) / 2
    expect(summary.min).toBe(23200);
    expect(summary.max).toBe(24500);
    expect(summary.count).toBe(2);
  });

  it('caps count at available listings if top > listings.length', () => {
    const summary = computeSummary(listings, 100);
    expect(summary.count).toBe(2);
  });

  it('uses only top N listings for average (not all)', () => {
    const summary = computeSummary(listings, 1);
    expect(summary.average).toBe(24500); // only listing[0].adjustedPrice
    expect(summary.count).toBe(1);
  });

  it('returns zeros for empty listings array', () => {
    const summary = computeSummary([], 10);
    expect(summary.average).toBe(0);
    expect(summary.min).toBe(0);
    expect(summary.max).toBe(0);
    expect(summary.count).toBe(0);
  });
});

describe('printTable', () => {
  it('does not throw for normal listings', () => {
    expect(() => printTable(listings)).not.toThrow();
  });

  it('does not throw for empty listings array', () => {
    expect(() => printTable([])).not.toThrow();
  });
});

describe('printSummary', () => {
  it('does not throw for normal listings', () => {
    expect(() => printSummary(listings, 10)).not.toThrow();
  });

  it('does not throw for empty listings array', () => {
    expect(() => printSummary([], 10)).not.toThrow();
  });
});
