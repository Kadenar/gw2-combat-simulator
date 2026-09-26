import { playerDamageTotal } from '#gw2/platform/combat/state/target-health.js';
import { finalizeConditionApplications } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2SimulationScore } from '#gw2/platform/simulation/types.js';
import type { Gw2ResolverEvent, Gw2ResolverResult } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';

interface CastCount {
  readonly name: string;
  count: number;
}

// Count casts from the already-filtered reporting window so rows and events share the same boundary.
function addCastsToBreakdown(ctx: Gw2ResolverRuntime, events: readonly Gw2ResolverEvent[]): Map<string, CastCount> {
  const countsById = new Map<string, number>();
  const output = new Map<string, CastCount>();
  for (const event of events) {
    if (event.type !== 'action') continue;
    const id = String(event.skillId ?? event.sourceId);
    const name = event.name || event.skillName || String(event.sourceId);
    countsById.set(id, (countsById.get(id) || 0) + 1);
    const row = output.get(name);
    if (row) row.count += 1;
    else output.set(name, { name, count: 1 });
  }

  // Match each breakdown row to its caster by stable id (breakdown keys already
  // carry skillId/sourceId). The display-name fallback covers effect/summon
  // rows whose events have no catalog skill id.
  for (const entry of ctx.breakdown.values()) {
    const identityId = String(entry.skillId ?? entry.sourceId);
    entry.casts = countsById.get(identityId) ?? output.get(entry.name)?.count ?? 0;
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

/** Presentation consumes executed events and an optional detached combat boundary, never a scheduler handoff. */
export function buildCombatResult(
  ctx: Gw2ResolverRuntime,
  score: Gw2SimulationScore,
  events: readonly Gw2ResolverEvent[],
  combatState: Gw2ResolverResult['combatState'] = {
    atSeconds: score.combatEndTime,
    profession: structuredClone(ctx.profession)
  }
): Gw2ResolverResult {
  const effectiveEnd = score.combatEndTime;
  finalizeConditionApplications(ctx, effectiveEnd);
  const damagePerSecond = (damage: number): number => (score.dpsWindow > 0 ? damage / score.dpsWindow : 0);
  const environmentWindow = Math.max(
    0,
    effectiveEnd - (score.hasExplicitCombatStart ? Number(score.combatStartTime || 0) : 0)
  );
  const environmentDamagePerSecond = (damage: number): number =>
    environmentWindow > 0 ? damage / environmentWindow : 0;
  const { output, ...numeric } = score;
  const effectiveEvents = events.filter((event) => event.at <= effectiveEnd) as Gw2ResolverEvent[];
  const casts = addCastsToBreakdown(ctx, effectiveEvents);
  return {
    ...numeric,
    breakdown: [...ctx.breakdown.values()].sort((left, right) => right.damage - left.damage),
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
        damageTicks: [...entry.damageTicks]
      }))
      .sort((left, right) => right.damage - left.damage),
    events: effectiveEvents,
    resolvedEvents: ctx.resolved.filter((event) => event.at <= effectiveEnd).sort((left, right) => left.at - right.at),
    procSteps: ctx.procSteps
      .filter((step) => step.start <= Math.round(effectiveEnd * 1000 + 0.1))
      .sort((left, right) => left.start - right.start),
    casts: [...casts.values()].sort((left, right) => right.count - left.count),
    randomness: {
      mode: ctx.random.mode,
      seed: ctx.random.seed
    },
    combatState
  };
}
