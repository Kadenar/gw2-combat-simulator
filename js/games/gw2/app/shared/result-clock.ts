/** Keeps authored timeline timestamps relative to Combat Start, independent of the first damage payout. */
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';

export function resultCombatReferenceMs(result: Gw2SimulationResult | null | undefined): number {
  const marker = result?.events?.find((event) => event.type === 'combat_start');
  return Number(marker?.at ?? 0) * 1000;
}

// Preserve milliseconds by default so snapshots and warnings align with the rotation.
export function formatTimelineTime(timeMs: unknown, referenceMs: unknown = 0, digits = 3): string {
  const precision = 10 ** digits;
  const seconds = (Number(timeMs || 0) - Number(referenceMs || 0)) / 1000;
  const normalized = Math.abs(seconds) < 0.5 / precision ? 0 : seconds;
  return `${normalized.toFixed(digits)}s`;
}

/** Result timestamps use millisecond precision relative to Combat Start. */
export function formatResultTimelineTime(timeMs: unknown, result: Gw2SimulationResult | null | undefined): string {
  return formatTimelineTime(timeMs, resultCombatReferenceMs(result), 3);
}
