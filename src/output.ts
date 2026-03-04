import Table from 'cli-table3';
import { writeFileSync } from 'fs';
import type { ScoredListing } from './types.js';

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
      String(l.price),
      String(Math.round(l.adjustedPrice)),
      String(l.miles),
      String(Math.round(l.dist)),
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
      USD.format(l.price),
      USD.format(Math.round(l.adjustedPrice)),
      l.miles.toLocaleString(),
      l.dist.toFixed(1),
      `${l.city}, ${l.state}`,
      l.vdp_url ?? '',
    ]);
  }

  console.log(table.toString());
}

export function writeCsv(listings: ScoredListing[], filePath: string): void {
  const rows = buildCsvRows(listings);
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
  writeFileSync(filePath, csv, 'utf8');
}

export function printSummary(listings: ScoredListing[], top: number): void {
  const { average, min, max, count } = computeSummary(listings, top);
  console.log(
    `\nTop ${count} average (adjusted): ${USD.format(average)}  |  Range: ${USD.format(min)} – ${USD.format(max)}\n`,
  );
}
