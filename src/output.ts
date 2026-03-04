import Table from 'cli-table3';
import { writeFileSync } from 'fs';
import type { SearchParams, ScoredListing } from './types.js';

export interface RunStats {
  totalReturned: number;
  dropped: number;
  scored: number;
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const HEADERS = ['Rank', 'Score', 'Year', 'Make', 'Trim', 'Model', 'Listed $', 'Adj $', 'Miles', 'Dist (mi)', 'Location', 'URL'];

export function buildCsvRows(listings: ScoredListing[]): string[][] {
  return [
    HEADERS,
    ...listings.map((l) => [
      String(l.rank),
      String(l.score),
      String(l.year),
      l.make,
      l.trim ?? '',
      l.model,
      String(l.price ?? ''),
      String(Math.round(l.adjustedPrice)),
      String(l.miles ?? ''),
      String(Math.round(l.dist ?? 0)),
      `${l.city}, ${l.state}`,
      l.vdp_url ?? '',
    ]),
  ];
}

export function computeSummary(listings: ScoredListing[], top: number) {
  const topN = listings.slice(0, Math.min(top, listings.length));
  if (topN.length === 0) {
    return { average: 0, min: 0, max: 0, count: 0 };
  }
  const prices = topN.map((l) => l.adjustedPrice);
  const average = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  return {
    average,
    min: Math.round(Math.min(...prices)),
    max: Math.round(Math.max(...prices)),
    count: topN.length,
  };
}

export function printTable(listings: ScoredListing[]): void {
  const table = new Table({
    head: HEADERS,
    style: { head: ['cyan'] },
    colWidths: [6, 7, 6, 10, 12, 10, 9, 12, 12, 11, 16, 50],
    wordWrap: true,
  });

  for (const l of listings) {
    table.push([
      l.rank,
      l.score,
      l.year,
      l.make,
      l.trim ?? '',
      l.model,
      USD.format(l.price ?? 0),
      USD.format(Math.round(l.adjustedPrice)),
      (l.miles ?? 0).toLocaleString(),
      (l.dist ?? 0).toFixed(1),
      `${l.city}, ${l.state}`,
      l.vdp_url ?? '',
    ]);
  }

  console.log(table.toString());
}

export function writeCsv(listings: ScoredListing[], filePath: string, prefixRows: string[][] = []): void {
  const rows = [...prefixRows, ...buildCsvRows(listings)];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  writeFileSync(filePath, csv, 'utf8');
}

export function printSummary(listings: ScoredListing[], top: number): void {
  const { average, min, max, count } = computeSummary(listings, top);
  console.log(
    `\nTop ${count} average (adjusted): ${USD.format(average)}  |  Range: ${USD.format(min)} – ${USD.format(max)}\n`,
  );
}

export function buildMethodologyRows(params: SearchParams, stats: RunStats): string[][] {
  const trimDisplay = params.trim ? ` ${params.trim}` : ' (any)';
  return [
    ['--- Search Methodology ---'],
    ['Subject vehicle', `${params.year} ${params.make} ${params.model}${trimDisplay}`],
    ['Subject mileage', params.mileage.toLocaleString()],
    ['Search area', `${params.radius} miles of ZIP ${params.zip}`],
    ['Year window', `${params.year - params.yearRange}–${params.year + params.yearRange}`],
    ['Mileage window', `${(params.mileage - params.mileageRange).toLocaleString()}–${(params.mileage + params.mileageRange).toLocaleString()}`],
    ['Mileage adj rate', `$${params.ratePerMile.toFixed(2)}/mile`],
    ['Listings returned', String(stats.totalReturned)],
    ['Dropped (no price/miles)', String(stats.dropped)],
    ['Scored & ranked', String(stats.scored)],
    ['Scoring weights', 'Distance 40pts + Mileage delta 40pts + Trim match 20pts (100pt max)'],
    ['Adj price formula', 'Listed price − (comp miles − subject miles) × rate/mile'],
    [],
  ];
}

export function printMethodology(params: SearchParams, stats: RunStats): void {
  const trimDisplay = params.trim ? ` ${params.trim}` : ' (any trim)';
  const yearMin = params.year - params.yearRange;
  const yearMax = params.year + params.yearRange;
  const milesMin = (params.mileage - params.mileageRange).toLocaleString();
  const milesMax = (params.mileage + params.mileageRange).toLocaleString();

  console.log('─'.repeat(70));
  console.log('Methodology');
  console.log('─'.repeat(70));
  console.log(`  Subject vehicle : ${params.year} ${params.make} ${params.model}${trimDisplay}`);
  console.log(`  Subject mileage : ${params.mileage.toLocaleString()} miles`);
  console.log(`  Search area     : within ${params.radius} miles of ZIP ${params.zip}`);
  console.log(`  Year window     : ${yearMin}–${yearMax}`);
  console.log(`  Mileage window  : ${milesMin}–${milesMax} miles`);
  console.log(`  Adj rate        : $${params.ratePerMile.toFixed(2)} per mile`);
  console.log();
  console.log(`  Listings from API : ${stats.totalReturned}`);
  console.log(`  Dropped (missing data) : ${stats.dropped}`);
  console.log(`  Scored & ranked : ${stats.scored}`);
  console.log();
  console.log('  Scoring (100 pt max):');
  console.log('    Distance score  — 40 pts, linear from 0 mi to radius limit');
  console.log('    Mileage delta   — 40 pts, linear from exact match to ±mileage-range');
  console.log('    Trim match      — 20 pts exact / 10 pts partial / 0 pts no match');
  console.log();
  console.log('  Adjusted price = Listed price − (comp miles − subject miles) × rate/mile');
  console.log('  A positive adj means the comp has more miles → its effective price is lower.');
  console.log('─'.repeat(70));
}
