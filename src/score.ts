import type { RawListing, SearchParams, ScoredListing } from './types.js';

export function computeScore(listing: RawListing, params: SearchParams): number {
  // Distance component (0–40 pts)
  const distScore = params.radius > 0
    ? 40 * Math.max(0, 1 - listing.dist / params.radius)
    : listing.dist === 0 ? 40 : 0;

  // Mileage delta component (0–40 pts)
  const mileageDelta = Math.abs(listing.miles - params.mileage);
  const mileageScore = params.mileageRange > 0
    ? 40 * Math.max(0, 1 - mileageDelta / params.mileageRange)
    : mileageDelta === 0 ? 40 : 0;

  // Trim match component (0–20 pts)
  const listingTrim = listing.trim?.toLowerCase() ?? '';
  const targetTrim = params.trim?.toLowerCase() ?? '';
  let trimScore = 0;
  if (targetTrim && listingTrim === targetTrim) {
    trimScore = 20;
  } else if (targetTrim && (listingTrim.includes(targetTrim) || targetTrim.includes(listingTrim))) {
    trimScore = 10;
  }

  return Math.round(distScore + mileageScore + trimScore);
}

export function applyMileageAdjustment(
  price: number,
  compMiles: number,
  subjectMiles: number,
  ratePerMile: number,
): number {
  return price - (compMiles - subjectMiles) * ratePerMile;
}

export function rankListings(listings: RawListing[], params: SearchParams): ScoredListing[] {
  return listings
    .map((listing) => ({
      ...listing,
      score: computeScore(listing, params),
      adjustedPrice: applyMileageAdjustment(
        listing.price,
        listing.miles,
        params.mileage,
        params.ratePerMile,
      ),
      rank: 0, // placeholder
    }))
    .sort((a, b) => b.score - a.score)
    .map((listing, i) => ({ ...listing, rank: i + 1 }));
}
