/** Shared arithmetic for capped GW2 resource pools, independent of any one resource's bookkeeping. */

import { clamp } from '#kernel/core/numeric.js';

/** Bounds a resource value into the pool's inclusive range. */
export function cappedResource(value: number, maximum: number): number {
  return clamp(value, 0, Math.max(0, maximum));
}

/** Adds a non-negative grant up to the supplied cap. */
export function grantCapped(current: number, amount: number, maximum: number): number {
  return cappedResource(current + Math.max(0, Number(amount || 0)), maximum);
}

/** A chronological window with a constant resource recovery or recharge rate. */
export interface RateInterval {
  readonly start: number;
  readonly end: number;
  readonly rate: number;
}

/** Resource comparisons tolerate arithmetic drift without borrowing the simulation clock tolerance. */
export const RESOURCE_TOLERANCE = 1e-9;

/** Tests affordability and full-resource gates with the same rounding allowance. */
export function resourceAtLeast(value: number, threshold: number): boolean {
  return value + RESOURCE_TOLERANCE >= threshold;
}
