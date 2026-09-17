/** Dragon Trigger charge timing shared by Bladesworn simulation and combat-log replay. */
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';

export const DRAGON_TRIGGER_MAXIMUM_CHARGE_MS = 2480;
export const DRAGON_TRIGGER_TACTICAL_RELOAD_MAXIMUM_CHARGE_MS = 1200;

/** Places every Dragon Trigger threshold on the 40 ms action grid while preserving the measured maximum duration. */
export function dragonChargeTickOffsetSeconds(
  tickIndex: number,
  maximumCharges: number,
  chargesPerInterval: number
): number {
  const intervals = Math.max(1, Math.ceil(maximumCharges / Math.max(1, chargesPerInterval)));
  const maximumDurationMs =
    chargesPerInterval > 1 ? DRAGON_TRIGGER_TACTICAL_RELOAD_MAXIMUM_CHARGE_MS : DRAGON_TRIGGER_MAXIMUM_CHARGE_MS;
  return quantizeGw2ActionTimingMs((maximumDurationMs * Math.max(1, tickIndex)) / intervals) / 1000;
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
    const thresholdMs = dragonChargeTickOffsetSeconds(index + 1, maximumCharges, intervalCharges) * 1000;
    const closestIndex = levels.indexOf(closest);
    const closestMs = dragonChargeTickOffsetSeconds(closestIndex + 1, maximumCharges, intervalCharges) * 1000;
    return Math.abs(thresholdMs - observedMs) < Math.abs(closestMs - observedMs) ? charges : closest;
  }, levels[0]);
}
