import { effectStateAt, effectSummary } from '#gw2/platform/results/effect-report.js';
import type { Gw2ResolverEvent, Gw2ResolverResult } from '#gw2/platform/resolver/types.js';
import type { SkillHit } from '#gw2/app/results/charts/hit-timeline-model.js';
import { type BoonGenerationByAudience } from '#gw2/platform/results/boon-generation.js';
import { clamp } from '#kernel/core/numeric.js';

// Builds renderer-independent chart data so simulations and views share one time-series contract.
export interface ChartPoint {
  readonly t: number;
  readonly v: number;
}

export type ChartEffectType = 'boon' | 'condition' | 'buff';

/** Presentation-only application markers, independent of subsequent condition payouts. */
export interface SkillApplication {
  readonly t: number;
  readonly label: string;
  readonly empowered: boolean;
}

export interface ChartEffectSummary {
  readonly relic?: boolean;
  readonly uptime: number;
  readonly averageStacks: number;
  readonly maximumStacks?: number;
  readonly maximumStackUptime?: number;
}

export interface ChartSeries {
  readonly durationMs: number;
  readonly dps: readonly ChartPoint[];
  readonly effects: Readonly<Record<string, readonly ChartPoint[]>>;
  readonly alliedEffects?: Readonly<Record<string, readonly ChartPoint[]>>;
  readonly alliedAverageStacks?: Readonly<Record<string, number>>;
  readonly effectTypes?: Readonly<Record<string, ChartEffectType>>;
  readonly effectUnits?: Readonly<Record<string, string>>;
  // Exact full-DPS-window summaries are independent of graph sampling and chart zoom.
  readonly effectSummaries?: Readonly<Record<string, ChartEffectSummary>>;
  readonly boonGeneration?: Readonly<
    Record<
      string,
      BoonGenerationByAudience & {
        readonly maximumStacks?: number;
      }
    >
  >;
  readonly alliedPlayerCount?: number;
  readonly cumulativeDamage?: readonly ChartPoint[];
  // Individual hits/ticks per skill breakdown row key (`group|name`), each
  // timestamped relative to the DPS window. Backs the per-skill damage-events
  // timeline in the expanded table row.
  readonly skillDamage?: Readonly<Record<string, readonly SkillHit[]>>;
  // One payout per condition in fight time, retaining each application's full or partial share.
  readonly conditionDamage?: Readonly<Record<string, readonly SkillHit[]>>;
  readonly skillApplications?: Readonly<Record<string, readonly SkillApplication[]>>;
}

export interface BuildChartSeriesOptions {
  readonly effectName?: (value: unknown, event: Gw2ResolverEvent) => string;
  // Attributes a resolved damage/condition event to a skill breakdown row key
  // (`group|name`), or null to omit it from the per-skill damage series.
  readonly skillKey?: (event: Gw2ResolverEvent) => string | null;
}

function eventDamageTicks(event: Gw2ResolverEvent): Array<{ at: number; damage: number; fraction?: number }> {
  return Array.isArray(event.damageTicks) ? (event.damageTicks as Array<{ at: number; damage: number }>) : [];
}

export function chartValueAt(points: readonly ChartPoint[], time: number): number {
  if (!points.length) return 0;
  // Series are step functions: use the latest sample at or before the pointer.
  let value = Number(points[0]!.v || 0);
  for (const point of points) {
    if (Number(point.t || 0) > time) break;
    value = Number(point.v || 0);
  }

  return value;
}

export function buildTimeSeries(
  result: Gw2ResolverResult,
  sampleStepMs = 250,
  { effectName = (value) => String(value || ''), skillKey }: BuildChartSeriesOptions = {}
): ChartSeries {
  // Chart time is relative to the DPS window, while simulation events use
  // absolute seconds. Keep the conversion at this boundary.
  const dpsStartMs = Math.max(0, Number(result.dpsStartTime ?? result.firstHitTime ?? 0) * 1000);
  const endMs = Math.max(dpsStartMs, result.combatEndTime * 1000);
  const durationMs = Math.max(1, endMs - dpsStartMs);
  const interval = clamp(Number(sampleStepMs) || 250, 50, 1000);
  const times: number[] = [];
  for (let time = 0; time < durationMs; time += interval) times.push(time);
  times.push(durationMs);
  const resolved = result.resolvedEvents || [];
  const damageEvents = resolved.filter(
    (event) =>
      (event.type === 'damage' || event.type === 'condition') &&
      (Number(event.damage || 0) > 0 || eventDamageTicks(event).some((tick) => Number(tick.damage || 0) > 0))
  );
  // Walk hits once in time order; ticks replace their application's aggregate damage and the source stays untouched.
  const damageHits = damageEvents
    .flatMap((event) => {
      const ticks = eventDamageTicks(event);
      return ticks.length ? ticks : [{ at: event.at, damage: Number(event.damage || 0) }];
    })
    .sort((left, right) => Number(left.at || 0) - Number(right.at || 0));
  let hitIndex = 0;
  let damage = 0;
  const dps = times.map((time) => {
    const elapsed = time / 1000;
    if (elapsed <= 0) return { t: time, v: 0 };
    const absoluteTime = dpsStartMs + time;
    while (hitIndex < damageHits.length && Number(damageHits[hitIndex]!.at || 0) * 1000 <= absoluteTime) {
      damage += Number(damageHits[hitIndex]!.damage || 0);
      hitIndex++;
    }

    return { t: time, v: damage / elapsed };
  });
  // Engine timelines contain accepted state and exact lifetimes; charts only select and sample tracks.
  const report = result.effectReport;
  const effects: Record<string, ChartPoint[]> = {};
  const alliedEffects: Record<string, ChartPoint[]> = {};
  const alliedAverageStacks: Record<string, number> = {};
  const effectTypes: Record<string, ChartEffectType> = {};
  const effectUnits: Record<string, string> = {};
  const effectSummaries: Record<string, ChartEffectSummary> = {};
  const label = (kind: string, _category: ChartEffectType, name?: string): string =>
    name ?? effectName(kind, { type: 'buff', kind, at: 0, source: 'effect', sourceId: kind, actorType: 'effect' });
  const valueAt = (track: (typeof report.tracks)[number], at: number): number => {
    const state = effectStateAt(report, track, at);
    return track.measure === 'remaining-duration'
      ? state?.count
        ? Math.max(0, (state.expiresAt ?? at) - at)
        : 0
      : (state?.count ?? 0);
  };

  for (const original of report.tracks) {
    const displayName = (source?: Gw2ResolverEvent) =>
      original.name ??
      effectName(
        original.kind,
        source ?? {
          type: 'buff',
          kind: original.kind,
          at: 0,
          source: 'effect',
          sourceId: original.kind,
          actorType: 'effect'
        }
      );
    // A metadata-dependent label can split an already-resolved track into visual variants without replaying mechanics.
    const names = new Set(original.segments.map((segment) => displayName(segment.source)));
    if (original.terminal.count) names.add(displayName(original.terminal.source));
    for (const display of names) {
      const track = {
        ...original,
        segments: original.segments.filter((segment) => displayName(segment.source) === display),
        terminal: displayName(original.terminal.source) === display ? original.terminal : { count: 0, expiresAt: null }
      };
      if (
        track.origin !== 'simulated' ||
        !['self', 'target'].includes(track.recipient) ||
        (!track.segments.length && !track.terminal.count)
      )
        continue;
      const name = Object.hasOwn(effects, display) ? `${display} (${track.id})` : display;
      const points = [
        ...new Set([
          ...times,
          ...track.segments
            .flatMap((segment) => [segment.start * 1000 - dpsStartMs, segment.end * 1000 - dpsStartMs])
            .filter((at) => at >= 0 && at <= durationMs)
        ])
      ].sort((a, b) => a - b);
      effects[name] = points.map((t) => ({ t, v: valueAt(track, (dpsStartMs + t) / 1000) }));
      effectTypes[name] = track.category;
      if (track.measure === 'remaining-duration') effectUnits[name] = 's';
      if (track.category !== 'condition')
        effectSummaries[name] = {
          ...effectSummary(track, dpsStartMs / 1000, endMs / 1000),
          ...(track.kind.startsWith('relic:') ? { relic: true } : {})
        };
    }
  }

  const boonGeneration = result.boonGeneration;
  const generation = new Map(Object.entries(boonGeneration.boons).map(([kind, value]) => [label(kind, 'boon'), value]));
  for (const kind of Object.keys(boonGeneration.boons)) {
    const tracks = report.tracks.filter((track) => track.kind === kind && track.origin === 'party-projection');
    const name = label(kind, 'boon');
    effectTypes[name] = 'boon';
    if (tracks.some((track) => track.measure === 'remaining-duration')) effectUnits[name] = 's';
    const alliedTimes = [
      ...new Set([
        ...times,
        ...tracks
          .flatMap((track) =>
            track.segments.flatMap((segment) => [segment.start * 1000 - dpsStartMs, segment.end * 1000 - dpsStartMs])
          )
          .filter((at) => at >= 0 && at <= durationMs)
      ])
    ].sort((a, b) => a - b);
    alliedEffects[name] = alliedTimes.map((t) => ({
      t,
      v:
        tracks.reduce((sum, track) => sum + valueAt(track, (dpsStartMs + t) / 1000), 0) /
        boonGeneration.alliedPlayerCount
    }));
    alliedAverageStacks[name] =
      tracks.reduce((sum, track) => sum + effectSummary(track, dpsStartMs / 1000, endMs / 1000).averageStacks, 0) /
      boonGeneration.alliedPlayerCount;
  }

  const cumulativeDamage = dps.map((point) => ({
    t: point.t,
    v: point.v * (point.t / 1000)
  }));
  const skillDamage: Record<string, SkillHit[]> = {};
  if (skillKey) {
    // Each strike is one hit at its time; conditions expand to a hit per
    // damaging tick. Times are relative to the DPS window, matching `dps`.
    for (const [eventIndex, event] of damageEvents.entries()) {
      const key = skillKey(event);
      if (!key) continue;
      const hits = skillDamage[key] || (skillDamage[key] = []);
      const crit = event.didCrit ?? null;
      // Preserve damage kind so periodic ticks cannot bridge otherwise separate strike bursts.
      const damageType = event.type === 'condition' ? 'condition' : 'strike';
      // Keep the condition label so skill tick details can distinguish simultaneous damage types.
      const conditionType = damageType === 'condition' ? effectName(event.condition, event) : undefined;
      // Preserve cast ownership for multi-hit inspection; unowned condition ticks share only their application.
      const activationId = event.activationId || `event:${eventIndex}`;
      const triggeredBy = event.triggeredBy || undefined;
      const damageTicks = eventDamageTicks(event);
      if (damageTicks.length) {
        // Condition ticks are neither critical nor non-critical strikes.
        for (const tick of damageTicks) {
          const value = Number(tick.damage || 0);
          const time = Number(tick.at || 0) * 1000 - dpsStartMs;
          if (value > 0 && time >= 0 && time <= durationMs) {
            hits.push({ t: time, v: value, crit: null, activationId, damageType, conditionType, triggeredBy });
          }
        }
      } else {
        const value = Number(event.damage || 0);
        const time = Number(event.at || 0) * 1000 - dpsStartMs;
        if (value > 0 && time >= 0 && time <= durationMs) {
          hits.push({
            t: time,
            v: value,
            crit: damageType === 'condition' ? null : crit,
            averagedCriticalDamage: event.averagedCriticalDamage,
            activationId,
            damageType,
            conditionType,
            triggeredBy
          });
        }
      }
    }

    for (const key of Object.keys(skillDamage)) {
      skillDamage[key]!.sort((left, right) => left.t - right.t);
    }
  }

  // Use the first-damage observation origin for both payouts and applications, matching the engine's fight clock.
  const conditionTicks = new Map<string, Map<number, SkillHit>>();
  for (const event of resolved) {
    if (event.type !== 'condition') continue;
    const conditionType = effectName(event.condition, event);
    if (!conditionType) continue;
    const recordedTicks = eventDamageTicks(event);
    const ticks = recordedTicks.length ? recordedTicks : [{ at: event.at, damage: Number(event.damage || 0) }];
    for (const tick of ticks) {
      const time = Math.round(Number(tick.at) * 1000 - dpsStartMs);
      const damage = Number(tick.damage || 0);
      // Keep zero-damage shares in a positive packet: shared rounding can assign an application zero.
      if (time < 0 || time > Math.round(endMs - dpsStartMs) || damage < 0 || !(damage > 0 || Number(tick.fraction) > 0))
        continue;
      const payouts = conditionTicks.get(conditionType) || new Map<number, SkillHit>();
      const previous = payouts.get(time);
      payouts.set(time, {
        t: time,
        v: (previous?.v || 0) + damage,
        crit: null,
        damageType: 'condition',
        conditionType,
        contributions: [
          ...(previous?.contributions || []),
          {
            source: event.name || event.skillName || event.sourceSkill || 'Unknown source',
            actor: String(event.summonOwner || event.summonKind || event.actorType || event.source || 'Unknown'),
            appliedAtMs: Math.round(Number(event.at) * 1000 - dpsStartMs),
            stacks: Number(event.stacks || 0),
            fraction: tick.fraction,
            damage
          }
        ]
      });
      conditionTicks.set(conditionType, payouts);
    }
  }

  return {
    durationMs,
    dps,
    effects,
    alliedEffects,
    alliedAverageStacks,
    effectTypes,
    effectSummaries,
    boonGeneration: Object.fromEntries(
      [...generation].map(([name, value]) => [
        name,
        {
          ...value,
          maximumStacks:
            report.tracks.find((track) => label(track.kind, track.category, track.name) === name)?.countLimit ??
            undefined
        }
      ])
    ),
    alliedPlayerCount: boonGeneration.alliedPlayerCount,
    effectUnits,
    cumulativeDamage,
    skillDamage,
    conditionDamage: Object.fromEntries(
      [...conditionTicks].map(([name, ticks]) => [
        name,
        [...ticks.values()].filter((tick) => tick.v > 0).sort((left, right) => left.t - right.t)
      ])
    )
  };
}

export function buildPhaseDpsSeries(
  cumulativeDamage: readonly ChartPoint[],
  startMs: number,
  endMs: number,
  startDamage: number,
  endDamage: number
): ChartPoint[] {
  const durationMs = Math.max(0, endMs - startMs);
  if (!(durationMs > 0)) return [];
  const points: ChartPoint[] = [{ t: 0, v: 0 }];
  for (const point of cumulativeDamage) {
    const timeMs = Number(point.t);
    if (!(timeMs > startMs && timeMs < endMs)) continue;
    const elapsedMs = timeMs - startMs;
    points.push({
      t: elapsedMs,
      v: Math.max(0, Number(point.v) - startDamage) / Math.max(0.001, elapsedMs / 1000)
    });
  }

  points.push({
    t: durationMs,
    v: Math.max(0, endDamage - startDamage) / Math.max(0.001, durationMs / 1000)
  });
  return points;
}

export function buildPhaseEffectSeries(points: readonly ChartPoint[], startMs: number, endMs: number): ChartPoint[] {
  const durationMs = Math.max(0, endMs - startMs);
  if (!points.length || !(durationMs > 0)) return [];
  return [
    { t: 0, v: chartValueAt(points, startMs) },
    ...points
      .filter((point) => point.t > startMs && point.t < endMs)
      .map((point) => ({ t: point.t - startMs, v: point.v })),
    { t: durationMs, v: chartValueAt(points, endMs) }
  ];
}
