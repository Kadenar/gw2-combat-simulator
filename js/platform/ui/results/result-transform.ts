import type { Gw2ResolverResult } from '../../gw2/resolver/types.js';
import type { Gw2SimulationResult } from '../../gw2/simulation/types.js';

export interface ResultSummaryMetric {
  readonly label: string;
  readonly value: string;
  readonly className: string;
  readonly group?: 'player' | 'target';
  readonly details?: readonly ResultSummaryMetricDetail[];
}

export interface ResultSummaryMetricDetail {
  readonly label: string;
  readonly value: string;
}

export interface TargetHealthBreakpointSnapshot {
  readonly healthPercent: number;
  readonly at: number;
  readonly elapsed: number;
  readonly damage: number;
  readonly dps: number;
  readonly environmentDamage: number;
  readonly targetDamage: number;
}

/**
 * Produces the ordered, preformatted metric cards consumed by result renderers.
 * Kill time is optional because fixed-horizon simulations may never reach the
 * configured target health.
 */
export function resultSummaryMetrics(
  result: Gw2ResolverResult,
  locale: string | string[] | undefined = undefined
): ResultSummaryMetric[] {
  const format = (value: unknown): string => Math.round(Number(value || 0)).toLocaleString(locale);
  const duration = Number(result.duration);
  const deathTime = result.deathTime == null ? null : Number(result.deathTime);
  const metrics: ResultSummaryMetric[] =
    deathTime == null
      ? [
          {
            label: 'Duration',
            value: `${duration.toFixed(2)}s`,
            className: ''
          }
        ]
      : [
          {
            label: 'Kill Time',
            value: `${deathTime.toFixed(2)}s`,
            className: 'kill-time'
          }
        ];
  metrics.push(
    { label: 'Player Damage', value: format(result.totalDamage), className: '', group: 'player' },
    { label: 'Player DPS', value: format(result.dps), className: 'dps', group: 'player' },
    { label: 'Strike', value: format(result.strikeDamage), className: '' },
    {
      label: 'Condition',
      value: format(result.conditionDamage),
      className: 'condi'
    }
  );
  if (Number(result.environmentDamage || 0) > 0) {
    // Keep external damage visually separate while still exposing the combined damage that reduced target health.
    metrics.push(
      {
        label: 'Environment Damage',
        value: format(result.environmentDamage),
        className: 'environment',
        group: 'target',
        details: [
          { label: 'Environment DPS', value: format(result.environmentDps) },
          ...(result.environmentConditionBreakdown || []).map((entry) => ({
            label: entry.name,
            value: format(entry.damage)
          }))
        ]
      },
      {
        label: 'Target Damage',
        value: format(Number(result.totalDamage || 0) + Number(result.environmentDamage || 0)),
        className: 'target-damage',
        group: 'target'
      }
    );
  }
  return metrics;
}

/**
 * Returns cumulative average-DPS snapshots when the target reaches each
 * remaining-health milestone. Combined damage selects the timestamp, while
 * the displayed damage and DPS remain player-only attribution.
 */
export function targetHealthBreakpointSnapshots(
  result: Gw2SimulationResult | null | undefined,
  targetHealth: unknown,
  remainingHealthPercents: readonly number[] = [80, 60, 40, 20]
): TargetHealthBreakpointSnapshot[] {
  const health = Number(targetHealth || 0);
  if (!(health > 0)) return [];

  const damageByTime = new Map<number, { player: number; environment: number }>();
  const addDamage = (at: unknown, damage: unknown, owner: 'player' | 'environment'): void => {
    const time = Number(at);
    const amount = Number(damage);
    if (!Number.isFinite(time) || !(amount > 0)) return;
    const current = damageByTime.get(time) || { player: 0, environment: 0 };
    current[owner] += amount;
    damageByTime.set(time, current);
  };

  for (const event of result?.resolvedEvents || []) {
    if (event.type === 'condition' && Array.isArray(event.damageTicks)) {
      const ticks = event.damageTicks as Array<{
        readonly at?: unknown;
        readonly damage?: unknown;
      }>;
      for (const tick of ticks) addDamage(tick.at, tick.damage, 'player');
    } else if (event.type === 'damage') {
      addDamage(event.at, event.damage, 'player');
    }
  }
  for (const condition of result?.environmentConditionBreakdown || []) {
    for (const tick of condition.damageTicks) {
      addDamage(tick.at, tick.damage, 'environment');
    }
  }

  const milestones = [...new Set(remainingHealthPercents)]
    .map(Number)
    .filter((percent) => percent > 0 && percent < 100)
    .sort((left, right) => right - left)
    .map((healthPercent) => ({
      healthPercent,
      damageThreshold: health * (1 - healthPercent / 100)
    }));
  const snapshots: TargetHealthBreakpointSnapshot[] = [];
  const dpsStartTime = Math.max(0, Number(result?.dpsStartTime ?? result?.firstHitTime ?? 0));
  let playerDamage = 0;
  let environmentDamage = 0;
  let milestoneIndex = 0;

  for (const [at, damage] of [...damageByTime.entries()].sort((left, right) => left[0] - right[0])) {
    playerDamage += damage.player;
    environmentDamage += damage.environment;
    const targetDamage = playerDamage + environmentDamage;
    while (milestoneIndex < milestones.length && targetDamage >= milestones[milestoneIndex]!.damageThreshold) {
      const milestone = milestones[milestoneIndex]!;
      const elapsed = Math.max(0, at - dpsStartTime);
      snapshots.push({
        healthPercent: milestone.healthPercent,
        at,
        elapsed,
        damage: playerDamage,
        dps: elapsed > 0 ? playerDamage / elapsed : 0,
        environmentDamage,
        targetDamage
      });
      milestoneIndex += 1;
    }

    if (milestoneIndex >= milestones.length) break;
  }

  return snapshots;
}
