#!/usr/bin/env -S npx tsx
import { program } from 'commander';
import { config } from 'dotenv';
import { decodeVin, searchInventory } from './api.js';
import { rankListings } from './score.js';
import { printTable, printSummary, writeCsv } from './output.js';
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
      console.log(`  → ${spec.year} ${spec.make} ${spec.model} ${spec.trim}`);
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
    spec = {
      year: parseInt(opts.year, 10),
      make: opts.make,
      model: opts.model,
      trim: opts.trim ?? '',
    };
  }

  const params: SearchParams = {
    ...spec,
    mileage: parseInt(opts.mileage, 10),
    zip: opts.zip,
    radius: parseInt(opts.radius, 10),
    yearRange: parseInt(opts.yearRange, 10),
    mileageRange: parseInt(opts.mileageRange, 10),
    top: parseInt(opts.top, 10),
    outFile: opts.out,
    ratePerMile: parseFloat(opts.rate),
    apiKey: apiKey!,
  };

  console.log(`\nSearching for ${spec.year}±${params.yearRange} ${spec.make} ${spec.model} ${spec.trim} within ${params.radius} miles of ${params.zip}...`);

  let listings;
  try {
    listings = await searchInventory(params);
  } catch (err) {
    console.error(`Search failed: ${(err as Error).message}`);
    process.exit(1);
  }

  if (listings.length === 0) {
    console.error('No results found. Try increasing --radius or --year-range.');
    process.exit(1);
  }

  console.log(`Found ${listings.length} listings. Scoring and ranking...\n`);
  const ranked = rankListings(listings, params);

  printTable(ranked);
  printSummary(ranked, params.top);

  writeCsv(ranked, params.outFile);
  console.log(`CSV saved to ${params.outFile}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
