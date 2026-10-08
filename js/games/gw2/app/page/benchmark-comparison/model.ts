import type { Benchmark } from '#gw2/app/page/benchmarks.js';
import type { ChartPoint } from '#gw2/app/results/charts/time-series-model.js';
import type { Gw2ResolverResult } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { GameContentAddress } from '#browser/game/contracts.js';
import type { RotationCommand } from '#gw2/platform/execution/rotation.js';
import type { Gw2Build } from '#gw2/platform/builds/types.js';
import { boundedInteger } from '#kernel/core/numeric.js';

export type ComparisonMode = 'average' | '1' | '5';

/** Read the canonical saved assumption without importing profession engines into the comparison UI. */
export function savedComparisonAlliedPlayerCount(buildData: unknown): number {
  if (!buildData || typeof buildData !== 'object' || Array.isArray(buildData)) throw new Error('Invalid saved build.');
  return boundedInteger((buildData as Gw2Build).assumptions?.alliedPlayerCount ?? 0, 0, 0, 4);
}

/** Apply one simulation's party override without mutating the prepared preset shared by later runs. */
export function comparisonConfig(config: Gw2Config, alliedPlayerCount: number | null): Gw2Config {
  if (alliedPlayerCount === null) return config;
  return { ...config, allies: { ...config.allies, count: alliedPlayerCount } };
}

export interface ComparisonRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly config: Gw2Config;
}

export interface ComparisonResult {
  readonly durationMs: number;
  /** Exact cumulative damage packets, relative to the engine's DPS origin. */
  readonly damage: readonly ChartPoint[];
  readonly dps: number;
  readonly totalDamage: number;
  readonly targetDied: boolean;
  readonly warnings: readonly string[];
}

/** Asset identity keeps same-name variants distinct and reuses completed runs across picker filters. */
export function comparisonKey(row: Pick<Benchmark, 'profession' | 'build' | 'rotation'>): string {
  return JSON.stringify([row.profession, row.build, row.rotation]);
}

/** Project only damage packets in the observation window so workers do not transfer full simulation histories. */
export function comparisonResult(result: Gw2ResolverResult): ComparisonResult {
  const durationMs = Math.max(0, (result.combatEndTime - result.dpsStartTime) * 1000);
  const hits = result.resolvedEvents.flatMap((event) => {
    if (event.type !== 'damage' && event.type !== 'condition') return [];
    const ticks = Array.isArray(event.damageTicks) ? (event.damageTicks as Array<{ at: number; damage: number }>) : [];
    return (ticks.length ? ticks : [{ at: event.at, damage: Number(event.damage ?? 0) }])
      .filter((hit) => hit.damage > 0 && hit.at >= result.dpsStartTime && hit.at <= result.combatEndTime)
      .map((hit) => ({ t: (hit.at - result.dpsStartTime) * 1000, v: hit.damage }));
  });
  hits.sort((a, b) => a.t - b.t);
  const damage: ChartPoint[] = [];
  let total = 0;
  for (const hit of hits) {
    total += hit.v;
    const point = { t: hit.t, v: total };
    if (damage.at(-1)?.t === hit.t) damage[damage.length - 1] = point;
    else damage.push(point);
  }

  return {
    durationMs,
    damage,
    dps: result.dps,
    totalDamage: result.totalDamage,
    targetDied: result.deathTime !== null,
    warnings: result.warnings
  };
}

/** Damage is a step function: include all packets at the cursor and never interpolate damage between hits. */
export function comparisonDamageAt(points: readonly ChartPoint[], timeMs: number): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid]!.t <= timeMs) low = mid + 1;
    else high = mid;
  }

  return low ? points[low - 1]!.v : 0;
}

/** Ended runs have no DPS at later times; partial rolling windows include the first damage packet. */
export function comparisonDpsAt(result: ComparisonResult, timeMs: number, mode: ComparisonMode): number | null {
  if (timeMs > result.durationMs) return null;
  if (!(timeMs > 0)) return 0;
  const start = mode === 'average' ? 0 : Math.max(0, timeMs - Number(mode) * 1000);
  const baseline = start > 0 ? comparisonDamageAt(result.damage, start) : 0;
  return (comparisonDamageAt(result.damage, timeMs) - baseline) / ((timeMs - start) / 1000);
}

/** Chart sampling affects drawing only; inspector values always query the exact cumulative packets. */
export function comparisonCurve(result: ComparisonResult, mode: ComparisonMode): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (let t = 0; t < result.durationMs; t += 250) points.push({ t, v: comparisonDpsAt(result, t, mode)! });
  points.push({ t: result.durationMs, v: comparisonDpsAt(result, result.durationMs, mode)! });
  return points;
}
