/** Cumulative player DPS at each displayed health threshold. */
import { TARGET_HEALTH_BANDS } from '#gw2/app/results/summary-metrics.js';
import type { Gw2SimulationScore } from '#gw2/platform/results/types.js';

// Final DPS already has its own column, so snapshots stop at 20% health.
export const OPTIMIZER_DPS_CHECKPOINTS = TARGET_HEALTH_BANDS.filter(({ endHealth }) => endHealth > 0);

/** Final effective DPS excludes overkill throughout the completed fight or rotation. */
export function optimizerEffectiveDps(result: Pick<Gw2SimulationScore, 'effectiveDamage' | 'dpsWindow'>): number {
  return result.dpsWindow > 0 ? result.effectiveDamage / result.dpsWindow : 0;
}

/** Each snapshot measures player damage from the first hit through the health threshold. */
export function optimizerDpsSnapshots(result: Pick<Gw2SimulationScore, 'healthCheckpoints' | 'dpsStartTime'>) {
  return OPTIMIZER_DPS_CHECKPOINTS.map(({ label, endHealth }) => {
    const point = result.healthCheckpoints?.find((point) => point.healthPercent === endHealth);

    if (!point) return { label, reached: false as const };

    const elapsed = Math.max(0, point.at - result.dpsStartTime);
    return {
      label,
      reached: true as const,
      elapsed,
      damage: point.playerDamage,
      cumulativeDps: elapsed > 0 ? point.playerDamage / elapsed : null
    };
  });
}
