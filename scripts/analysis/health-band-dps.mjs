import { TARGET_HEALTH_BANDS, targetHealthBreakpointSnapshots } from '#gw2/app/results/summary-metrics.js';
import { clamp } from '#kernel/core/numeric.js';

/**
 * Capture benchmark DPS from combat start and within each health band using the application's Analysis boundaries.
 * @param {import('#gw2/platform/results/types.js').Gw2SimulationResult} result
 * @param {number} targetHealth
 * @param {number} [startingHealthPercent]
 * @returns {import('#gw2/app/results/summary-metrics.js').TargetHealthBandDps}
 */
export function targetHealthBandDps(result, targetHealth, startingHealthPercent = 100) {
  const boundaries = new Map();

  if (Number.isFinite(targetHealth) && targetHealth > 0) {
    boundaries.set(clamp(startingHealthPercent, 0, 100), { elapsed: 0, damage: 0 });
    for (const point of targetHealthBreakpointSnapshots(result, targetHealth, undefined, startingHealthPercent)) {
      boundaries.set(point.healthPercent, point);
    }

    // The final band ends at the DPS clock's end: the kill, or combat end for a surviving target. A surviving
    // target therefore measures its final phase from the 20% crossing to combat end.
    boundaries.set(0, { elapsed: Math.max(0, result.dpsWindow), damage: result.totalDamage });
  }

  return Object.fromEntries(
    TARGET_HEALTH_BANDS.map(({ id, startHealth, endHealth }) => {
      const start = boundaries.get(startHealth);
      const end = boundaries.get(endHealth);
      const phase =
        start && end && end.elapsed > start.elapsed && end.damage >= start.damage
          ? (end.damage - start.damage) / (end.elapsed - start.elapsed)
          : null;
      const cumulative = end && end.elapsed > 0 ? end.damage / end.elapsed : null;
      return [id, { cumulative, phase }];
    })
  );
}
