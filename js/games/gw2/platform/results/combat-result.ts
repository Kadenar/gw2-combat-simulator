import { playerDamageTotal } from '#gw2/platform/combat/state/target-health.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildBoonGeneration, projectedPartyEffects } from '#gw2/platform/results/boon-generation.js';
import { projectResolvedEvents } from '#gw2/platform/results/resolved-events.js';
import type { Gw2ResolverResult, Gw2SimulationScore } from '#gw2/platform/results/types.js';

interface CastCount {
  readonly name: string;
  count: number;
}

// Build the public named cast summary from the same combat-bounded actions exposed in the result.
function countCasts(events: readonly Gw2ResolverEvent[]): Map<string, CastCount> {
  const output = new Map<string, CastCount>();
  for (const event of events) {
    if (event.type !== 'action') continue;
    const name = event.name || event.skillName || String(event.sourceId);
    const row = output.get(name);
    if (row) row.count += 1;
    else output.set(name, { name, count: 1 });
  }

  return output;
}

/** Derives numeric windows and totals directly from completed combat state in either execution path. */
export function buildSimulationScore(
  ctx: Gw2ResolverRuntime,
  rotationEndTime: number,
  hasExplicitCombatStart: boolean
): Gw2SimulationScore {
  if (ctx.horizon == null) throw new TypeError('Results require a known observation end.');
  const totalDamage = playerDamageTotal(ctx);
  const effectiveEnd = ctx.deathTime ?? ctx.horizon;
  const explicitCombatStart = ctx.combatStartTime ?? 0;
  // DPS always begins with the first surviving positive damage event. An
  // explicit Combat Start only filters earlier combat events and provides the
  // fallback for a damage-free encounter; it is not itself damage.
  const dpsStart = ctx.firstHitTime ?? (hasExplicitCombatStart ? explicitCombatStart : 0);
  const dpsWindow = Math.max(0, effectiveEnd - dpsStart);
  const damagePerSecond = (damage: number): number => (dpsWindow > 0 ? damage / dpsWindow : 0);
  // Environment DPS uses the target-active window and never borrows the
  // player's first-hit observation boundary.
  const environmentStart = hasExplicitCombatStart ? explicitCombatStart : 0;
  const environmentWindow = Math.max(0, effectiveEnd - environmentStart);
  const environmentDamagePerSecond = (damage: number): number =>
    environmentWindow > 0 ? damage / environmentWindow : 0;

  const score: Gw2SimulationScore = {
    output: 'score',
    rotationEndTime,
    observationEndTime: ctx.horizon,
    combatEndTime: effectiveEnd,
    combatStartTime: hasExplicitCombatStart ? (ctx.combatStartTime ?? null) : ctx.firstHitTime,
    hasExplicitCombatStart,
    dpsStartTime: dpsStart,
    dpsWindow,
    firstHitTime: ctx.firstHitTime,
    lastHitTime: ctx.lastHitTime,
    deathTime: ctx.deathTime,
    totalDamage,
    dps: damagePerSecond(totalDamage),
    strikeDamage: ctx.totals.strike,
    conditionDamage: ctx.totals.condition,
    environmentDamage: ctx.environmentDamage,
    environmentDps: environmentDamagePerSecond(ctx.environmentDamage),
    warnings: [...new Set(ctx.warnings)]
  };
  return score;
}

/** Presentation consumes finalized combat state and executed events bounded by the combat score. */
export function buildCombatResult(
  ctx: Gw2ResolverRuntime,
  score: Gw2SimulationScore,
  events: readonly Gw2ResolverEvent[]
): Gw2ResolverResult {
  const effectiveEnd = score.combatEndTime;
  const damagePerSecond = (damage: number): number => (score.dpsWindow > 0 ? damage / score.dpsWindow : 0);
  const environmentWindow = Math.max(0, effectiveEnd - (score.hasExplicitCombatStart ? score.combatStartTime || 0 : 0));
  const environmentDamagePerSecond = (damage: number): number =>
    environmentWindow > 0 ? damage / environmentWindow : 0;
  const { output, ...numeric } = score;
  const effectiveEvents = events.filter((event) => event.at <= effectiveEnd);
  const casts = countCasts(effectiveEvents);
  // Editor-only runs retain combat facts but skip both live histories and expensive hypothetical party projection.
  const generation = ctx.effectRecorder
    ? buildBoonGeneration(ctx.resolved, score.combatStartTime ?? score.dpsStartTime, effectiveEnd)
    : null;
  const effectReport = ctx.effectRecorder?.finish(effectiveEnd);
  const partyReport = generation ? projectedPartyEffects(generation, effectiveEnd) : null;
  // Recorder reports already own detached snapshots; copy only fields still owned by the live resolver.
  return {
    ...numeric,
    warnings: [...numeric.warnings],
    effectReport:
      effectReport && partyReport ? { ...effectReport, tracks: [...effectReport.tracks, ...partyReport.tracks] } : null,
    boonGeneration: generation
      ? { alliedPlayerCount: generation.alliedPlayerCount, boons: Object.fromEntries(generation.boons) }
      : null,
    breakdown: [...ctx.breakdown.values()]
      .map((entry) => ({ ...entry }))
      .sort((left, right) => right.damage - left.damage),
    conditionBreakdown: [...ctx.conditions.values()]
      .map((entry) => ({
        name: entry.name,
        damage: entry.damage,
        dps: damagePerSecond(entry.damage),
        averageStacks: damagePerSecond(entry.stackSeconds)
      }))
      .sort((left, right) => right.damage - left.damage),
    environmentConditionBreakdown: [...ctx.environmentConditions.values()]
      .filter((entry) => entry.damage > 0)
      .map((entry) => ({
        name: entry.name,
        damage: entry.damage,
        dps: environmentDamagePerSecond(entry.damage),
        averageStacks: environmentDamagePerSecond(entry.stackSeconds),
        stacks: entry.stacks,
        damageTicks: entry.damageTicks.map((tick) => ({ ...tick }))
      }))
      .sort((left, right) => right.damage - left.damage),
    events: structuredClone(effectiveEvents),
    resolvedEvents: projectResolvedEvents(
      ctx.resolved.filter((event) => event.at <= effectiveEnd),
      effectiveEnd
    ).sort((left, right) => left.at - right.at),
    procSteps: structuredClone(
      ctx.procSteps
        .filter((step) => step.start <= Math.round(effectiveEnd * 1000 + 0.1))
        .sort((left, right) => left.start - right.start)
    ),
    casts: [...casts.values()].sort((left, right) => right.count - left.count),
    randomness: {
      mode: ctx.random.mode,
      seed: ctx.random.seed
    }
  };
}
