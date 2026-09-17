import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

export function resultCombatReferenceMs(result: Gw2SimulationResult | null | undefined): number {
  const marker = result?.events?.find((event) => event.type === 'combat_start');
  if (!marker) return 0;
  return Number(marker.at || 0) * 1000;
}

export function formatTimelineTime(timeMs: unknown, referenceMs: unknown = 0, digits = 2): string {
  const precision = 10 ** digits;
  const seconds = (Number(timeMs || 0) - Number(referenceMs || 0)) / 1000;
  const normalized = Math.abs(seconds) < 0.5 / precision ? 0 : seconds;
  return `${normalized.toFixed(digits)}s`;
}

export function formatResultTimelineTime(
  timeMs: unknown,
  result: Gw2SimulationResult | null | undefined,
  digits = 2
): string {
  return formatTimelineTime(timeMs, resultCombatReferenceMs(result), digits);
}
