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

    // A recorded kill supplies an exact final boundary; surviving targets use final overall DPS below.
    if (result.deathTime != null) {
      boundaries.set(0, { elapsed: Math.max(0, result.deathTime - result.dpsStartTime), damage: result.totalDamage });
    }
  }

  return Object.fromEntries(
    TARGET_HEALTH_BANDS.map(({ id, startHealth, endHealth }) => {
      if (endHealth === 0 && result.deathTime == null && Number.isFinite(targetHealth) && targetHealth > 0) {
        // Non-killing runs still get a final chart value in both modes, using the simulation's reported DPS.
        const finalDps = Number.isFinite(result.dps) && result.dps >= 0 ? result.dps : null;
        return [id, { cumulative: finalDps, phase: finalDps }];
      }

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
