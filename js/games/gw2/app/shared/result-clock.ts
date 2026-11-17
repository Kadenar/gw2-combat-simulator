/** Keeps timeline, event-log, and warning timestamps on the same first-damage clock as DPS charts. */
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';

export function resultCombatReferenceMs(result: Gw2SimulationResult | null | undefined): number {
  return (result?.dpsStartTime ?? 0) * 1000;
}

// Preserve milliseconds by default so snapshots and warnings align with the rotation.
export function formatTimelineTime(timeMs: unknown, referenceMs: unknown = 0, digits = 3): string {
  const precision = 10 ** digits;
  const seconds = (Number(timeMs || 0) - Number(referenceMs || 0)) / 1000;
  const normalized = Math.abs(seconds) < 0.5 / precision ? 0 : seconds;
  return `${normalized.toFixed(digits)}s`;
}

/** Result timestamps use millisecond precision relative to the DPS observation start. */
export function formatResultTimelineTime(timeMs: unknown, result: Gw2SimulationResult | null | undefined): string {
  return formatTimelineTime(timeMs, resultCombatReferenceMs(result), 3);
}
