import type { Gw2ResolverResult } from '#gw2/platform/results/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import { clamp } from '#kernel/core/numeric.js';

export interface ResultSummaryMetric {
  readonly title?: string;
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

export const TARGET_HEALTH_BANDS = [
  { id: '100-80', label: '100-80%', startHealth: 100, endHealth: 80 },
  { id: '80-60', label: '80-60%', startHealth: 80, endHealth: 60 },
  { id: '60-40', label: '60-40%', startHealth: 60, endHealth: 40 },
  { id: '40-20', label: '40-20%', startHealth: 40, endHealth: 20 },
  { id: '20-0', label: '20-0%', startHealth: 20, endHealth: 0 }
] as const;

export type TargetHealthBandId = (typeof TARGET_HEALTH_BANDS)[number]['id'];
export type TargetHealthBandDps = Readonly<
  Record<
    TargetHealthBandId,
    {
      readonly cumulative: number | null;
      readonly phase: number | null;
    }
  >
>;

/** Report player DPS from combat start and within each health band using the same boundaries as Analysis. */
export function targetHealthBandDps(
  result: Gw2SimulationResult,
  targetHealth: number,
  startingHealthPercent = 100
): TargetHealthBandDps {
  const boundaries = new Map<number, { elapsed: number; damage: number }>();
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
  ) as TargetHealthBandDps;
}

/**
 * Produces the ordered, preformatted metric cards consumed by result renderers.
 * Kill time is optional because fixed-horizon simulations may never reach the
 * configured target health.
 * Timing cards preserve milliseconds to match detailed results.
 */
export function baseResultSummaryMetrics(
  result: Gw2ResolverResult,
  locale: string | string[] | undefined = undefined
): ResultSummaryMetric[] {
  const format = (value: unknown): string => Math.round(Number(value || 0)).toLocaleString(locale);
  const duration = Number(result.combatEndTime);
  const deathTime = result.deathTime == null ? null : Number(result.deathTime);
  const metrics: ResultSummaryMetric[] =
    deathTime == null
      ? [
          {
            label: 'Duration',
            value: `${duration.toFixed(3)}s`,
            className: ''
          }
        ]
      : [
          {
            label: 'Kill Time',
            value: `${deathTime.toFixed(3)}s`,
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
  remainingHealthPercents: readonly number[] = [80, 60, 40, 20],
  startingHealthPercent: unknown = 100
): TargetHealthBreakpointSnapshot[] {
  const health = Number(targetHealth || 0);
  if (!(health > 0)) return [];
  const configuredStartingPercent = Number(startingHealthPercent);
  const startingPercent = Number.isFinite(configuredStartingPercent) ? clamp(configuredStartingPercent, 0, 100) : 100;

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
    // Milestones already passed before combat do not belong on the damage timeline.
    .filter((percent) => percent > 0 && percent < startingPercent)
    .sort((left, right) => right - left)
    .map((healthPercent) => ({
      healthPercent,
      damageThreshold: health * ((startingPercent - healthPercent) / 100)
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
