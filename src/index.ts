#!/usr/bin/env -S npx tsx
import { program } from 'commander';
import { config } from 'dotenv';
import { decodeVin, searchInventory } from './api.js';
import { rankListings } from './score.js';
import { printTable, printSummary, writeCsv, printMethodology, buildMethodologyRows } from './output.js';
import type { RunStats } from './output.js';
import type { SearchParams, VehicleSpec } from './types.js';

config(); // load .env

program
  .name('comparables')
  .description('Find vehicle comparables for insurance total-loss negotiation')
  .option('--vin <vin>', 'VIN of your vehicle (auto-decodes year/make/model/trim)')
  .option('--year <n>', 'Model year')
  .option('--make <str>', 'Make')
  .option('--model <str>', 'Model')
  .option('--trim <str>', 'Trim level')
  .requiredOption('--mileage <n>', 'Your odometer reading')
  .requiredOption('--zip <zip>', 'Your ZIP code')
  .option('--radius <miles>', 'Search radius in miles', '100')
  .option('--year-range <n>', '±N years from model year', '1')
  .option('--mileage-range <n>', '±N miles for search window', '25000')
  .option('--top <n>', 'Number of top matches for summary', '10')
  .option('--out <file>', 'CSV output filename', 'comparables.csv')
  .option('--rate <$/mile>', 'Mileage adjustment rate per mile', '0.10')
  .option('--api-key <key>', 'MarketCheck API key (overrides .env)');

program.parse();
const opts = program.opts<{
  vin?: string;
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  mileage: string;
  zip: string;
  radius: string;
  yearRange: string;
  mileageRange: string;
  top: string;
  out: string;
  rate: string;
  apiKey?: string;
}>();

// --- Input validation (runs before API key check so field errors surface first) ---
function parseIntArg(val: string, flag: string): number {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) {
    console.error(`Error: --${flag} must be a whole number, got "${val}".`);
    process.exit(1);
  }
  return n;
}

function parseFloatArg(val: string, flag: string): number {
  const n = parseFloat(val);
  if (Number.isNaN(n)) {
    console.error(`Error: --${flag} must be a number, got "${val}".`);
    process.exit(1);
  }
  return n;
}

const mileage = parseIntArg(opts.mileage, 'mileage');
const radius = parseIntArg(opts.radius, 'radius');
const yearRange = parseIntArg(opts.yearRange, 'year-range');
const mileageRange = parseIntArg(opts.mileageRange, 'mileage-range');
const top = parseIntArg(opts.top, 'top');
const ratePerMile = parseFloatArg(opts.rate, 'rate');

if (mileage <= 0) { console.error('Error: --mileage must be greater than 0.'); process.exit(1); }
if (radius <= 0) { console.error('Error: --radius must be greater than 0.'); process.exit(1); }
if (yearRange <= 0) { console.error('Error: --year-range must be greater than 0.'); process.exit(1); }
if (mileageRange <= 0) { console.error('Error: --mileage-range must be greater than 0.'); process.exit(1); }
if (top <= 0) { console.error('Error: --top must be greater than 0.'); process.exit(1); }
if (ratePerMile < 0) { console.error('Error: --rate must be 0 or greater.'); process.exit(1); }

// ZIP code basic format check
if (!/^\d{5}(-\d{4})?$/.test(opts.zip)) {
  console.error(`Error: --zip must be a 5-digit US ZIP code, got "${opts.zip}".`);
  process.exit(1);
}

// API key check (after field validation so format errors surface first)
const apiKey = opts.apiKey ?? process.env.MARKETCHECK_API_KEY;
if (!apiKey) {
  console.error('Error: MarketCheck API key required. Set MARKETCHECK_API_KEY in .env or pass --api-key.');
  process.exit(1);
}

async function run() {
  let spec: VehicleSpec;

  if (opts.vin) {
    console.log(`Decoding VIN ${opts.vin}...`);
    try {
      spec = await decodeVin(opts.vin, apiKey!);
      console.log(`  → ${spec.year} ${spec.make} ${spec.model}${spec.trim ? ' ' + spec.trim : ''}`);
    } catch (err) {
      console.error(`VIN decode failed: ${(err as Error).message}`);
      console.error('Please provide --year, --make, --model, --trim manually.');
      process.exit(1);
    }
  } else {
    if (!opts.year || !opts.make || !opts.model) {
      console.error('Error: Provide either --vin or all of --year, --make, --model.');
      process.exit(1);
    }
    const year = parseIntArg(opts.year, 'year');
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear + 2) {
      console.error(`Error: --year must be between 1900 and ${currentYear + 2}, got "${opts.year}".`);
      process.exit(1);
    }
    spec = {
      year,
      make: opts.make,
      model: opts.model,
      trim: opts.trim ?? '',
    };
  }

  const params: SearchParams = {
    ...spec,
    mileage,
    zip: opts.zip,
    radius,
    yearRange,
    mileageRange,
    top,
    outFile: opts.out,
    ratePerMile,
    apiKey: apiKey!,
  };

  const trimDisplay = spec.trim ? ` ${spec.trim}` : '';
  console.log(`\nSearching for ${spec.year}±${params.yearRange} ${spec.make} ${spec.model}${trimDisplay} within ${params.radius} miles of ${params.zip}...`);

  let listings;
  try {
    listings = await searchInventory(params);
  } catch (err) {
    console.error(`Search failed: ${(err as Error).message}`);
    process.exit(1);
  }

  const complete = listings.filter(l => l.price != null && l.miles != null);
  const dropped = listings.length - complete.length;
  if (dropped > 0) {
    console.log(`Skipped ${dropped} listing(s) with missing price or mileage data.`);
  }

  if (complete.length === 0) {
    console.error('No usable results (all listings were missing price or mileage). Try increasing --radius or --year-range.');
    process.exit(1);
  }

  console.log(`Found ${complete.length} listings. Scoring and ranking...\n`);
  listings = complete;
  const ranked = rankListings(listings, params);

  const stats: RunStats = {
    totalReturned: listings.length + dropped,
    dropped,
    scored: ranked.length,
  };

  printTable(ranked);
  printSummary(ranked, params.top);
  printMethodology(params, stats);

  const methodologyRows = buildMethodologyRows(params, stats);
  writeCsv(ranked, params.outFile, methodologyRows);
  console.log(`CSV saved to ${params.outFile}`);
}

run().catch((err) => {
  console.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
