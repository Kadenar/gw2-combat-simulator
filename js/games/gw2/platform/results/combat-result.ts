/** Combines finalized combat facts with independently projected damage observations. */
import { playerDamageTotal } from '#gw2/platform/combat/state/target-health.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import {
  buildBoonGeneration,
  generatedBoonCoverage,
  projectedPartyEffects
} from '#gw2/platform/results/boon-generation.js';
import { projectCombatObservations } from '#gw2/platform/results/combat-observations.js';
import type { DamageReportProjection } from '#gw2/platform/results/damage-report.js';
import { uniqueDiagnostics } from '#gw2/platform/results/diagnostics.js';
import type { ScheduledBoonApplication } from '#gw2/platform/results/sustained-boon-generation.js';
import type { Gw2ResolverResult, Gw2SimulationScore } from '#gw2/platform/results/types.js';
import { cloneData } from '#kernel/core/clone.js';

/** Derives numeric windows and totals directly from completed combat state in either execution path. */
export function buildSimulationScore(ctx: Gw2ResolverRuntime, rotationEndTime: number): Gw2SimulationScore {
  if (ctx.horizon == null) throw new TypeError('Results require a known observation end.');

  const hasExplicitCombatStart = ctx.engagement.explicit;
  const totalDamage = playerDamageTotal(ctx);
  const effectiveEnd = ctx.deathTime ?? ctx.horizon;
  const explicitCombatStart = ctx.engagement.startTime ?? 0;
  // DPS always begins with the first surviving positive damage event. An
  // explicit Combat Start only filters earlier combat events and provides the
  // fallback for a damage-free encounter; it is not itself damage.
  const dpsStart = ctx.encounter
    ? explicitCombatStart
    : (ctx.firstHitTime ?? (hasExplicitCombatStart ? explicitCombatStart : 0));
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
    combatStartTime: hasExplicitCombatStart ? (ctx.engagement.startTime ?? null) : ctx.firstHitTime,
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
    warnings: uniqueDiagnostics(ctx.warnings),
    ...(ctx.boonGeneration
      ? {
          boonCoverage: generatedBoonCoverage(
            ctx.boonGeneration.finish(
              hasExplicitCombatStart ? explicitCombatStart : (ctx.firstHitTime ?? dpsStart),
              effectiveEnd
            ).boons,
            dpsWindow
          )
        }
      : {})
  };
  return score;
}

/** Presentation consumes finalized combat state and executed events bounded by the combat score. */
export function buildCombatResult(
  ctx: Gw2ResolverRuntime,
  score: Gw2SimulationScore,
  events: readonly Gw2ResolverEvent[],
  damageReport: DamageReportProjection,
  scheduledBoons: readonly ScheduledBoonApplication[]
): Gw2ResolverResult {
  const effectiveEnd = score.combatEndTime;
  const { output, ...numeric } = score;
  const effectiveEvents = events.filter((event) => event.at <= effectiveEnd);
  // Editor-only runs retain combat facts but skip both live histories and expensive hypothetical party projection.
  const generation = ctx.effectRecorder
    ? buildBoonGeneration(ctx.resolved, score.combatStartTime ?? score.dpsStartTime, effectiveEnd, scheduledBoons)
    : null;
  const effectReport = ctx.effectRecorder?.finish(effectiveEnd);
  const partyReport = generation ? projectedPartyEffects(generation, effectiveEnd) : null;
  // Recorder reports already own detached snapshots; copy only fields still owned by the live resolver.
  return {
    ...numeric,
    warnings: numeric.warnings.map((diagnostic) => ({ ...diagnostic })),
    effectReport:
      effectReport && partyReport ? { ...effectReport, tracks: [...effectReport.tracks, ...partyReport.tracks] } : null,
    boonGeneration: generation
      ? { boons: Object.fromEntries(generation.boons), sustained: generation.sustained }
      : null,
    ...damageReport,
    events: cloneData(effectiveEvents),
    ...projectCombatObservations(ctx, effectiveEnd),
    randomness: {
      mode: ctx.random.mode,
      seed: ctx.random.seed
    }
  };
}
