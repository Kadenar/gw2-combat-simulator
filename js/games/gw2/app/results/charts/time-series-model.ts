import type { Gw2ProcStep, Gw2ResolverEvent, Gw2ResolverResult } from '#gw2/platform/resolver/types.js';
import { remainingDurationStackSeconds } from '#gw2/platform/combat/state/boons.js';
import type { SkillHit } from '#ui/results/charts/hit-timeline.js';

// Builds renderer-independent chart data so simulations and views share one time-series contract.
export interface ChartPoint {
  readonly t: number;
  readonly v: number;
}

export type ChartEffectType = 'boon' | 'condition' | 'buff';

export interface ChartSeries {
  readonly durationMs: number;
  readonly dps: readonly ChartPoint[];
  readonly effects: Readonly<Record<string, readonly ChartPoint[]>>;
  readonly effectTypes?: Readonly<Record<string, ChartEffectType>>;
  readonly effectUnits?: Readonly<Record<string, string>>;
  readonly cumulativeDamage?: readonly ChartPoint[];
  // Individual hits/ticks per skill breakdown row key (`group|name`), each
  // timestamped relative to the DPS window. Backs the per-skill damage-events
  // timeline (in the table) and the hit-marker strip on the DPS chart.
  readonly skillDamage?: Readonly<Record<string, readonly SkillHit[]>>;
  // Display name per skill key, for timeline labels and tooltips.
  readonly skillNames?: Readonly<Record<string, string>>;
}

export interface BuildChartSeriesOptions {
  readonly effectName?: (value: unknown, event: Gw2ResolverEvent) => string;
  readonly effectType?: (value: unknown, event: Gw2ResolverEvent) => ChartEffectType;
  readonly replacementGroup?: (value: unknown, event: Gw2ResolverEvent) => string;
  readonly timedProcEffect?: (proc: Gw2ProcStep) => { readonly name: string; readonly type?: ChartEffectType } | null;
  readonly stackCaps?: Readonly<Record<string, number>>;
  readonly durationStackCaps?: Readonly<Record<string, number>>;
  // Attributes a resolved damage/condition event to a skill breakdown row key
  // (`group|name`), or null to omit it from the per-skill damage series.
  readonly skillKey?: (event: Gw2ResolverEvent) => string | null;
  // Human-readable label for a skill key, used by the skill-damage panel.
  readonly skillName?: (key: string, event: Gw2ResolverEvent) => string;
}

interface ChartEffectApplication {
  readonly name: string;
  readonly type: ChartEffectType;
  readonly start: number;
  readonly end: number;
  readonly stacks: number;
  readonly replacementGroup: string;
}

function eventDamageTicks(event: Gw2ResolverEvent): Array<{ at: number; damage: number }> {
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

export function buildChartSeries(
  result: Gw2ResolverResult,
  sampleStepMs = 250,
  {
    effectName = (value) => String(value || ''),
    effectType = (_value, event) => (event.type === 'condition' ? 'condition' : 'buff'),
    replacementGroup = () => '',
    timedProcEffect,
    stackCaps = {},
    durationStackCaps = {},
    skillKey,
    skillName
  }: BuildChartSeriesOptions = {}
): ChartSeries {
  // Chart time is relative to the DPS window, while simulation events use
  // absolute seconds. Keep the conversion at this boundary.
  const dpsStartMs = Math.max(0, Number(result.dpsStartTime ?? result.firstHitTime ?? 0) * 1000);
  const endMs = Math.max(
    dpsStartMs,
    Math.round(
      Number(
        result.deathTime ??
          (result.dpsWindow != null
            ? Number(result.dpsStartTime || 0) + Number(result.dpsWindow)
            : Number(result.duration || 0))
      ) * 1000
    )
  );
  const durationMs = Math.max(1, endMs - dpsStartMs);
  const interval = Math.max(50, Math.min(1000, Number(sampleStepMs) || 250));
  const times: number[] = [];
  for (let time = 0; time < durationMs; time += interval) times.push(time);
  times.push(durationMs);
  const resolved = result.resolvedEvents || [];
  const damageEvents = resolved.filter(
    (event) =>
      (event.type === 'damage' || event.type === 'condition') &&
      (Number(event.damage || 0) > 0 || eventDamageTicks(event).some((tick) => Number(tick.damage || 0) > 0))
  );
  const dps = times.map((time) => {
    const elapsed = time / 1000;
    if (elapsed <= 0) return { t: time, v: 0 };
    const absoluteTime = dpsStartMs + time;
    let damage = 0;
    for (const event of damageEvents) {
      const damageTicks = eventDamageTicks(event);
      if (damageTicks.length) {
        // Condition applications store aggregate damage plus individual ticks;
        // use ticks to avoid showing future condition damage too early.
        damage += damageTicks
          .filter((tick) => Number(tick.at || 0) * 1000 <= absoluteTime)
          .reduce((sum, tick) => sum + Number(tick.damage || 0), 0);
      } else if (Number(event.at || 0) * 1000 <= absoluteTime) {
        damage += Number(event.damage || 0);
      }
    }

    return { t: time, v: damage / elapsed };
  });
  const applications: ChartEffectApplication[] = [];
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

  for (const event of result.events || []) {
    // Generic buffs and materialized boons share timed-effect visualization.
    if (event.type !== 'buff' || event.resolvedAudience?.includesSelf !== true || !Number(event.duration || 0)) {
      continue;
    }

    const start = Number(event.at || 0) * 1000 - dpsStartMs;
    applications.push({
      name: effectName(event.kind, event),
      type: effectType(event.kind, event),
      start,
      end: start + Number(event.duration) * 1000,
      stacks: Number(event.stacks || 1),
      replacementGroup: replacementGroup(event.kind, event)
    });
  }

  // Timed proc records describe state windows that do not necessarily emit a
  // buff event. Treat refreshes as replacements so the chart reports binary
  // uptime instead of counting overlapping activation records as stacks.
  if (timedProcEffect) {
    for (const proc of result.procSteps || []) {
      const effect = timedProcEffect(proc);
      const start = Number(proc.start) - dpsStartMs;
      const end = Number(proc.expiresAt) - dpsStartMs;
      if (!effect?.name || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      applications.push({
        name: effect.name,
        type: effect.type || 'buff',
        start,
        end,
        stacks: 1,
        replacementGroup: `timed-proc:${effect.name}`
      });
    }
  }

  const effects: Record<string, ChartPoint[]> = {};
  const effectTypes: Record<string, ChartEffectType> = {};
  for (const name of new Set(applications.map((entry) => entry.name))) {
    const matching = applications
      .filter((entry) => entry.name === name)
      .sort((left, right) => left.start - right.start);
    effectTypes[name] = matching[0]?.type || 'buff';
    const durationApplications = matching.map((entry) => ({
      at: entry.start / 1000,
      duration: (entry.end - entry.start) / 1000,
      stacks: entry.stacks
    }));
    effects[name] = times.map((time) => {
      if (durationStackCaps[name] != null) {
        return {
          t: time,
          v: remainingDurationStackSeconds(durationApplications, time / 1000, {
            maximum: durationStackCaps[name]
          })
        };
      }

      const activeReplacements = new Map<string, (typeof applications)[number]>();
      for (const entry of applications) {
        if (!entry.replacementGroup || entry.start > time) continue;
        const active = activeReplacements.get(entry.replacementGroup);
        if (!active || entry.start >= active.start) {
          activeReplacements.set(entry.replacementGroup, entry);
        }
      }

      return {
        t: time,
        v: Math.min(
          stackCaps[name] ?? Infinity,
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
        )
      };
    });
  }

  const cumulativeDamage = dps.map((point) => ({
    t: point.t,
    v: point.v * (point.t / 1000)
  }));
  const skillDamage: Record<string, SkillHit[]> = {};
  const skillNames: Record<string, string> = {};
  if (skillKey) {
    // Each strike is one hit at its time; conditions expand to a hit per
    // damaging tick. Times are relative to the DPS window, matching `dps`.
    for (const event of damageEvents) {
      const key = skillKey(event);
      if (!key) continue;
      const hits = skillDamage[key] || (skillDamage[key] = []);
      if (skillName && skillNames[key] == null) {
        skillNames[key] = skillName(key, event);
      }

      const crit = event.didCrit ?? null;
      const damageTicks = eventDamageTicks(event);
      if (damageTicks.length) {
        // Condition ticks are neither critical nor non-critical strikes.
        for (const tick of damageTicks) {
          const value = Number(tick.damage || 0);
          const time = Number(tick.at || 0) * 1000 - dpsStartMs;
          if (value > 0 && time >= 0 && time <= durationMs) {
            hits.push({ t: time, v: value, crit: null });
          }
        }
      } else {
        const value = Number(event.damage || 0);
        const time = Number(event.at || 0) * 1000 - dpsStartMs;
        if (value > 0 && time >= 0 && time <= durationMs) {
          hits.push({ t: time, v: value, crit });
        }
      }
    }

    for (const key of Object.keys(skillDamage)) {
      skillDamage[key]!.sort((left, right) => left.t - right.t);
    }
  }

  return {
    durationMs,
    dps,
    effects,
    effectTypes,
    effectUnits: Object.fromEntries(Object.keys(durationStackCaps).map((name) => [name, 's'])),
    cumulativeDamage,
    skillDamage,
    skillNames
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
