import type { Gw2ProcStep, Gw2ResolverEvent, Gw2ResolverResult } from '#gw2/platform/resolver/types.js';
import { buffApplicationStacks, isStandardBoon, remainingDurationStackSeconds } from '#gw2/platform/combat/boons.js';
import { boonApplicationsAt } from '#gw2/platform/combat/boons.js';
import type { SkillHit } from '#ui/results/charts/hit-timeline-model.js';
import { eventCausalOrder } from '#kernel/events/queue.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import {
  buildBoonGeneration,
  type BoonGeneration,
  type BoonGenerationByAudience
} from '#gw2/app/results/charts/boon-generation.js';
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
  readonly generation?: BoonGeneration;
  readonly durationStacking: boolean;
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
  readonly effectType?: (value: unknown, event: Gw2ResolverEvent) => ChartEffectType;
  readonly replacementGroup?: (value: unknown, event: Gw2ResolverEvent) => string;
  readonly timedProcEffect?: (proc: Gw2ProcStep) => { readonly name: string; readonly type?: ChartEffectType } | null;
  readonly stateEffects?: (event: Gw2ResolverEvent) => readonly {
    readonly name: string;
    readonly stacks: number;
    readonly expiresAt?: number;
  }[];
  readonly stackCaps?: Readonly<Record<string, number>>;
  readonly durationStackCaps?: Readonly<Record<string, number>>;
  // Attributes a resolved damage/condition event to a skill breakdown row key
  // (`group|name`), or null to omit it from the per-skill damage series.
  readonly skillKey?: (event: Gw2ResolverEvent) => string | null;
}

interface ChartEffectApplication {
  readonly extension?: boolean;
  readonly name: string;
  readonly type: ChartEffectType;
  readonly start: number;
  readonly end: number;
  readonly stacks: number;
  readonly replacementGroup: string;
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
  {
    effectName = (value) => String(value || ''),
    effectType = (_value, event) => (event.type === 'condition' ? 'condition' : 'buff'),
    replacementGroup = () => '',
    timedProcEffect,
    stateEffects,
    stackCaps = {},
    durationStackCaps = {},
    skillKey
  }: BuildChartSeriesOptions = {}
): ChartSeries {
  // Chart time is relative to the DPS window, while simulation events use
  // absolute seconds. Keep the conversion at this boundary.
  const dpsStartMs = Math.max(0, Number(result.dpsStartTime ?? result.firstHitTime ?? 0) * 1000);
  const endMs = Math.max(dpsStartMs, Math.round(result.combatEndTime * 1000));
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
  const applications: ChartEffectApplication[] = [];
  // State snapshots persist until replaced or expired, including zero states that close an active window.
  for (const event of result.events || resolved) {
    for (const effect of stateEffects?.(event) || []) {
      applications.push({
        name: effect.name,
        type: 'buff',
        start: event.at * 1000 - dpsStartMs,
        end: effect.expiresAt == null ? endMs - dpsStartMs : effect.expiresAt * 1000 - dpsStartMs,
        stacks: effect.stacks,
        replacementGroup: `state:${effect.name}`
      });
    }
  }

  // Convert conditions and buffs to half-open [start, end) stack intervals.
  for (const event of resolved) {
    if (event.type !== 'condition') continue;
    const start = Number(event.at || 0) * 1000 - dpsStartMs;
    const end =
      Number(
        event.naturalExpiresAt ??
          event.expiresAt ??
          Number(event.at || 0) + Number(event.effectiveDuration ?? event.duration ?? 0)
      ) *
        1000 -
      dpsStartMs;
    if (end > start) {
      applications.push({
        name: effectName(event.condition, event),
        type: effectType(event.condition, event),
        start,
        end,
        stacks: Number(event.stacks || 1),
        replacementGroup: replacementGroup(event.condition, event)
      });
    }
  }

  // Resolved buffs include trait procs and final audiences; scheduled-only results remain supported.
  const combatMarker = [...(result.events || []), ...resolved].find((event) => event.type === 'combat_start');
  const combatStart = Number(result.combatStartTime ?? combatMarker?.at ?? dpsStartMs / 1000);
  const markerOrder = combatMarker ? eventCausalOrder(combatMarker) : null;
  // Combat strips prepared boons. Discard their history before computing graphs, uptime, or generation;
  // an explicit marker can precede the first hit, and its causal order separates same-time preparation.
  const buffs = (resolved.some((event) => event.type === 'buff') ? resolved : result.events || []).filter((event) => {
    if (event.cancelled || event.actorType === 'environment') return false;
    if (event.type !== 'boon_extension' && !(event.type === 'buff' && isStandardBoon(event.kind))) return true;
    const order = eventCausalOrder(event);
    return (
      event.at >= combatStart &&
      !(event.at === combatStart && markerOrder != null && order != null && order < markerOrder)
    );
  });
  const boonGeneration = buildBoonGeneration(buffs, combatStart, endMs / 1000);
  const generation = new Map(
    [...boonGeneration.boons].map(([kind, value]) => [
      effectName(
        kind,
        buffs.find((event) => event.type === 'buff' && String(event.kind).toLowerCase() === kind)!
      ),
      value
    ])
  );
  const hasExtensions = buffs.some((event) => event.type === 'boon_extension');
  const extendedKinds = new Set<string>();
  for (const event of buffs) {
    // Reconstruct standard boon history once so plots show the same extensions and caps as combat queries.
    if (hasExtensions && event.type === 'buff' && isStandardBoon(event.kind)) {
      const kind = String(event.kind);
      if (extendedKinds.has(kind)) continue;
      extendedKinds.add(kind);
      for (const application of boonApplicationsAt(buffs, kind, Infinity)) {
        if (!application.resolvedAudience.includesSelf) continue;
        applications.push({
          name: effectName(kind, event),
          type: effectType(kind, event),
          start: application.at * 1000 - dpsStartMs,
          end: application.expiresAt * 1000 - dpsStartMs,
          stacks: application.stacks,
          extension: application.extension,
          replacementGroup: replacementGroup(kind, event)
        });
      }

      continue;
    }

    // Generic buffs and materialized boons share timed-effect visualization.
    if (event.type !== 'buff' || event.resolvedAudience?.includesSelf !== true || !Number(event.duration || 0)) {
      continue;
    }

    const start = Number(event.at || 0) * 1000 - dpsStartMs;
    applications.push({
      name: effectName(event.kind, event),
      type: effectType(event.kind, event),
      start,
      end: gw2EffectExpiresAt(Number(event.at || 0), Number(event.duration)) * 1000 - dpsStartMs,
      stacks: Number(event.stacks || 1),
      replacementGroup: replacementGroup(event.kind, event)
    });
  }

  // Timed proc records describe state windows that do not necessarily emit a
  // buff event. A refresh replaces the previous stack state instead of adding to it.
  const procStackCaps: Record<string, number> = {};
  const relicEffects = new Set<string>();
  if (timedProcEffect) {
    for (const proc of result.procSteps || []) {
      const effect = timedProcEffect(proc);
      const start = Number(proc.start) - dpsStartMs;
      const end = Number(proc.expiresAt ?? (proc.effectState ? endMs : NaN)) - dpsStartMs;
      if (!effect?.name || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      applications.push({
        name: effect.name,
        type: effect.type || 'buff',
        start,
        end,
        stacks: proc.effectState?.stacks ?? 1,
        replacementGroup: `timed-proc:${effect.name}`
      });
      if (proc.effectState) procStackCaps[effect.name] = proc.effectState.maximumStacks;
      if (proc.type === 'relic_proc') relicEffects.add(effect.name);
    }
  }

  const effects: Record<string, ChartPoint[]> = {};
  const effectTypes: Record<string, ChartEffectType> = {};
  const effectSummaries: Record<string, ChartEffectSummary> = {};
  for (const name of new Set(applications.map((entry) => entry.name))) {
    if (!applications.some((entry) => entry.name === name && entry.stacks > 0 && entry.end > entry.start)) continue;
    const matching = applications
      .filter((entry) => entry.name === name)
      .sort((left, right) => left.start - right.start);
    effectTypes[name] = matching[0]?.type || 'buff';
    const durationApplications = matching.map((entry) => ({
      extension: entry.extension,
      at: entry.start / 1000,
      duration: (entry.end - entry.start) / 1000,
      stacks: entry.stacks
    }));
    const maximumStacks = procStackCaps[name] ?? stackCaps[name];
    const valueAt = (time: number): number => {
      if (durationStackCaps[name] != null) {
        return remainingDurationStackSeconds(durationApplications, time / 1000, {
          maximum: durationStackCaps[name]
        });
      }

      const activeReplacements = new Map<string, (typeof applications)[number]>();
      for (const entry of applications) {
        if (!entry.replacementGroup || entry.start > time) continue;
        const active = activeReplacements.get(entry.replacementGroup);
        if (!active || entry.start >= active.start) {
          activeReplacements.set(entry.replacementGroup, entry);
        }
      }

      return Math.min(
        maximumStacks ?? Infinity,
        matching.reduce(
          (sum, entry) =>
            sum +
            (entry.start <= time &&
            entry.end > time &&
            (!entry.replacementGroup || activeReplacements.get(entry.replacementGroup) === entry)
              ? entry.stacks
              : 0),
          0
        )
      );
    };

    effects[name] = times.map((time) => ({ t: time, v: valueAt(time) }));
    if (effectTypes[name] === 'condition') continue;

    // Integrate at actual transitions, including other effects that replace this one. Duration pools drain
    // between grants, so their contribution is active time, never the area under the remaining-seconds graph.
    const groups = new Set(matching.map((entry) => entry.replacementGroup).filter(Boolean));
    const boundaries = [
      0,
      ...new Set(
        applications
          .filter((entry) => entry.name === name || groups.has(entry.replacementGroup))
          .flatMap((entry) => [entry.start, entry.end])
          .filter((time) => time > 0 && time < endMs - dpsStartMs)
      ),
      endMs - dpsStartMs
    ].sort((left, right) => left - right);
    let activeMs = 0;
    let stackMs = 0;
    let maximumMs = 0;
    const durationStacking = durationStackCaps[name] != null;
    for (let index = 1; index < boundaries.length; index++) {
      const start = boundaries[index - 1]!;
      const elapsed = boundaries[index]! - start;
      const value = valueAt(start);
      const active = durationStacking ? Math.min(elapsed, value * 1000) : value > 0 ? elapsed : 0;
      activeMs += active;
      stackMs += durationStacking ? active : value * elapsed;
      if (maximumStacks != null && value >= maximumStacks) maximumMs += elapsed;
    }

    effectSummaries[name] = {
      ...(relicEffects.has(name) ? { relic: true } : {}),
      uptime: activeMs / durationMs,
      averageStacks: stackMs / durationMs,
      ...(maximumStacks == null || durationStacking
        ? {}
        : { maximumStacks, maximumStackUptime: maximumMs / durationMs }),
      ...(generation.has(name) ? { generation: generation.get(name)!.self } : {}),
      durationStacking
    };
  }

  // Average capped state across all four projected allies, including recipients with no boon.
  const alliedEffects: Record<string, ChartPoint[]> = {};
  const alliedAverageStacks: Record<string, number> = {};
  for (const kind of boonGeneration.boons.keys()) {
    const event = buffs.find((entry) => entry.type === 'buff' && String(entry.kind).toLowerCase() === kind)!;
    const name = effectName(kind, event);
    effectTypes[name] = 'boon';
    const recipients = boonGeneration.alliedApplications.map((history) => {
      const applications = history.get(kind) || [];
      const durationStacking = durationStackCaps[name] != null;
      const valueAt = (at: number): number =>
        durationStacking
          ? remainingDurationStackSeconds(applications, at, { maximum: durationStackCaps[name] })
          : buffApplicationStacks(applications, kind, at, stackCaps[name] ?? Infinity);
      // Integrate each recipient at exact transitions so caps, downtime, and partial audiences affect averages.
      const boundaries = [
        dpsStartMs / 1000,
        ...new Set(
          applications
            .flatMap((application) => [application.at, application.expiresAt])
            .filter((at) => at > dpsStartMs / 1000 && at < endMs / 1000)
        ),
        endMs / 1000
      ].sort((left, right) => left - right);
      let stackSeconds = 0;
      for (let index = 1; index < boundaries.length; index++) {
        const start = boundaries[index - 1]!;
        const elapsed = boundaries[index]! - start;
        const value = valueAt(start);
        stackSeconds += durationStacking ? Math.min(elapsed, value) : value * elapsed;
      }

      return { valueAt, averageStacks: (stackSeconds * 1000) / durationMs };
    });
    alliedAverageStacks[name] =
      recipients.reduce((sum, recipient) => sum + recipient.averageStacks, 0) / boonGeneration.alliedPlayerCount;
    alliedEffects[name] = times.map((time) => ({
      t: time,
      v:
        recipients.reduce((sum, recipient) => sum + recipient.valueAt((dpsStartMs + time) / 1000), 0) /
        boonGeneration.alliedPlayerCount
    }));
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
          maximumStacks: stackCaps[name]
        }
      ])
    ),
    alliedPlayerCount: boonGeneration.alliedPlayerCount,
    effectUnits: Object.fromEntries(Object.keys(durationStackCaps).map((name) => [name, 's'])),
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
