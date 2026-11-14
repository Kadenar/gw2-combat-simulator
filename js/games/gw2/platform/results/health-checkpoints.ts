/** Record whole-hit health milestones and separately cap final player damage for effective DPS. */
import { targetHealthReached } from '#gw2/platform/combat/state/target-health.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { clamp } from '#kernel/core/numeric.js';

export interface HealthCheckpoint {
  readonly healthPercent: number;
  readonly at: number;
  readonly playerDamage: number;
}

/** Environment damage advances milestones; player snapshots include every payout at the crossing timestamp. */
export function createHealthCheckpointRecorder(config: Gw2Config) {
  const maximum = config.target?.health ?? 0;

  if (!(maximum > 0) || config.encounter || config.target?.fixedHealthFraction != null) return null;

  const starting = clamp(config.target?.startingHealthFraction ?? 1, 0, 1);
  const available = maximum * starting;
  // Final effective damage is tracked separately; snapshots stop at 20% health.
  const thresholds = [80, 60, 40, 20].filter((percent) => percent < starting * 100);
  const points: HealthCheckpoint[] = [];
  let player = 0;
  let environment = 0;
  let effectivePlayer = 0;

  return {
    observe(at: number, playerDamage: number, environmentDamage: number): void {
      const playerDelta = playerDamage - player;
      const environmentDelta = environmentDamage - environment;
      const before = player + environment;
      const delta = playerDelta + environmentDelta;

      if (!(delta > 0)) return;

      const state = { totals: { strike: playerDamage }, environmentDamage };
      while (points.length < thresholds.length && targetHealthReached(config, state, thresholds[points.length])) {
        points.push({
          healthPercent: thresholds[points.length],
          at,
          playerDamage
        });
      }

      // Analysis groups simultaneous payouts, so earlier crossings at this time receive the same whole-hit total.
      for (let index = points.length - 1; index >= 0 && points[index].at === at; index--)
        points[index] = { ...points[index], playerDamage };

      const accepted = clamp(available - before, 0, delta);
      const playerShare = environmentDelta === 0 ? accepted : playerDelta * (accepted / delta);
      effectivePlayer += playerShare;
      player = playerDamage;
      environment = environmentDamage;
    },
    finish(): { effectiveDamage: number; checkpoints: readonly HealthCheckpoint[] } {
      return { effectiveDamage: effectivePlayer, checkpoints: points.map((point) => ({ ...point })) };
    }
  };
}
