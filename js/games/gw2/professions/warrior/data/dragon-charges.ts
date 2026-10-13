/** Dragon Trigger charge timing shared by Bladesworn simulation and combat-log replay. */
import { GW2_ACTION_TICK_MS, quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';

const DRAGON_TRIGGER_CHARGE_INTERVAL_MS = 240;

/** Daring Dragon starts conversion one action tick earlier; Reload changes charge yield, not the 240 ms cadence. */
export function dragonChargeTickOffsetSeconds(tickIndex: number, daringDragon: boolean): number {
  return (DRAGON_TRIGGER_CHARGE_INTERVAL_MS * Math.max(1, tickIndex) - (daringDragon ? GW2_ACTION_TICK_MS : 0)) / 1000;
}

/** Resolves an observed charge duration to the nearest reachable Dragon Charge threshold. */
export function dragonChargesForDurationMs(
  durationMs: number,
  maximumCharges: number,
  chargesPerInterval: number,
  daringDragon: boolean
): number {
  const intervalCharges = Math.max(1, chargesPerInterval);
  const levels: number[] = [];
  for (let charges = intervalCharges; charges < maximumCharges; charges += intervalCharges) levels.push(charges);
  levels.push(maximumCharges);
  const observedMs = quantizeGw2ActionTimingMs(durationMs);
  return levels.reduce((closest, charges, index) => {
    const thresholdMs = dragonChargeTickOffsetSeconds(index + 1, daringDragon) * 1000;
    const closestIndex = levels.indexOf(closest);
    const closestMs = dragonChargeTickOffsetSeconds(closestIndex + 1, daringDragon) * 1000;
    return Math.abs(thresholdMs - observedMs) < Math.abs(closestMs - observedMs) ? charges : closest;
  }, levels[0]);
}
