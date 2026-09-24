/** Dragon Trigger charge timing shared by Bladesworn simulation and combat-log replay. */
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';

export const DRAGON_TRIGGER_CHARGE_INTERVAL_MS = 240;

/** Charges spend Flow every 240 ms; Tactical Reload changes charges gained, not the interval. */
export function dragonChargeTickOffsetSeconds(tickIndex: number): number {
  return (DRAGON_TRIGGER_CHARGE_INTERVAL_MS * Math.max(1, tickIndex)) / 1000;
}

/** Resolves an observed charge duration to the nearest reachable Dragon Charge threshold. */
export function dragonChargesForDurationMs(
  durationMs: number,
  maximumCharges: number,
  chargesPerInterval: number
): number {
  const intervalCharges = Math.max(1, chargesPerInterval);
  const levels: number[] = [];
  for (let charges = intervalCharges; charges < maximumCharges; charges += intervalCharges) levels.push(charges);
  levels.push(maximumCharges);
  const observedMs = quantizeGw2ActionTimingMs(durationMs);
  return levels.reduce((closest, charges, index) => {
    const thresholdMs = dragonChargeTickOffsetSeconds(index + 1) * 1000;
    const closestIndex = levels.indexOf(closest);
    const closestMs = dragonChargeTickOffsetSeconds(closestIndex + 1) * 1000;
    return Math.abs(thresholdMs - observedMs) < Math.abs(closestMs - observedMs) ? charges : closest;
  }, levels[0]);
}
