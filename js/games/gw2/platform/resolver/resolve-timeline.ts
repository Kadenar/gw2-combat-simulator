import { canonicalEvent, StableEventQueue } from '#kernel/events/queue.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { assertScheduledEventStream as assertPlatformStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import {
  createGw2ResolverHandlerRegistry,
  gw2ResolverPhase,
  runGw2ResolverEventLoop
} from '#gw2/platform/resolver/event-loop.js';
import { playerDamageTotal } from '#gw2/platform/combat/state/target-health.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { normalizeBoonDuration } from '#gw2/platform/combat/boons.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverEventHandlers } from '#gw2/platform/resolver/event-handlers.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { createGw2EquipmentReactionContributions } from '#gw2/platform/resolver/equipment-reactions.js';
import { recordPassiveRelicTimeline, relicStrikeMultiplier } from '#gw2/platform/equipment/relics/query.js';
import { createGw2HitResolution } from '#gw2/platform/resolver/hit-resolution.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2SimulationScore } from '#gw2/platform/simulation/types.js';
import type { Gw2ResolverHandoff } from '#gw2/platform/engine/events/scheduled-stream.js';

import type { Gw2ResolverEvent, Gw2ResolverResult, ResolveGw2TimelineOptions } from '#gw2/platform/resolver/types.js';
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

/**
 * Shapes the resolver result from drained runtime state: DPS window, sorted
 * breakdowns, effective-window event/proc filtering, and cast counts.
 */
function buildResolverResult(
  ctx: Gw2ResolverRuntime,
  scheduled: ReturnType<typeof assertPlatformStream>,
  handoff: Gw2ResolverHandoff
): Gw2ResolverResult | Gw2SimulationScore {
  const totalDamage = playerDamageTotal(ctx);
  const effectiveEnd = ctx.deathTime ?? ctx.horizon;
  const explicitCombatStart = Number(handoff.combatStartTime || 0);
  // DPS always begins with the first surviving positive damage event. An
  // explicit Combat Start only filters earlier combat events and provides the
  // fallback for a damage-free encounter; it is not itself damage.
  const dpsStart = ctx.firstHitTime ?? (handoff.hasExplicitCombatStart ? explicitCombatStart : 0);
  const dpsWindow = Math.max(0, effectiveEnd - dpsStart);
  const damagePerSecond = (damage: number): number => (dpsWindow > 0 ? damage / dpsWindow : 0);
  // Environment DPS uses the target-active window and never borrows the
  // player's first-hit observation boundary.
  const environmentStart = handoff.hasExplicitCombatStart ? explicitCombatStart : 0;
  const environmentWindow = Math.max(0, effectiveEnd - environmentStart);
  const environmentDamagePerSecond = (damage: number): number =>
    environmentWindow > 0 ? damage / environmentWindow : 0;

  const score: Gw2SimulationScore = {
    output: 'score',
    duration: scheduled.rotationEndTime,
    combatStartTime: handoff.hasExplicitCombatStart ? explicitCombatStart : ctx.firstHitTime,
    hasExplicitCombatStart: Boolean(handoff.hasExplicitCombatStart),
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
  // Stop before filtering, sorting, casts, and table projections when only numerical output was requested.
  if (!ctx.reporting) return score;
  const { output, ...numeric } = score;
  const effectiveEvents = scheduled.events.filter((event) => event.at <= effectiveEnd) as Gw2ResolverEvent[];
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
    resolvedEvents: ctx.resolved.sort((left, right) => left.at - right.at),
    procSteps: ctx.procSteps
      .filter((step) => step.start <= Math.round(effectiveEnd * 1000 + 0.1))
      .sort((left, right) => left.start - right.start),
    casts: [...casts.values()].sort((left, right) => right.count - left.count),
    randomness: {
      mode: ctx.random.mode,
      seed: ctx.random.seed
    },
    profession: ctx.profession
  };
}

/**
 * Resolves a scheduled GW2 event stream using common handlers plus exclusive
 * profession-owned custom handlers.
 */
export function resolveGw2Timeline(options: ResolveGw2TimelineOptions & { output: 'score' }): Gw2SimulationScore;
export function resolveGw2Timeline(options: ResolveGw2TimelineOptions & { output?: 'detailed' }): Gw2ResolverResult;
export function resolveGw2Timeline(options: ResolveGw2TimelineOptions): Gw2ResolverResult | Gw2SimulationScore;
export function resolveGw2Timeline({
  onPhase,
  damageDiagnostics = false,
  output = 'detailed',
  stream,
  config,
  profession,
  traits,
  query: queryOverride,
  helpers
}: ResolveGw2TimelineOptions): Gw2ResolverResult | Gw2SimulationScore {
  const started = onPhase ? performance.now() : 0;

  const validated = assertPlatformStream(stream);
  // Scheduler boon predictions guide later casts/resources; surviving resolver hits own their actual effects.
  const scheduled = {
    ...validated,
    rotationEndTime: canonicalTime(validated.rotationEndTime),
    resolutionEndTime: canonicalTime(validated.resolutionEndTime ?? validated.rotationEndTime),
    resolverHandoff: {
      ...validated.resolverHandoff,
      ...(validated.resolverHandoff.combatStartTime == null
        ? {}
        : {
            combatStartTime: canonicalTime(validated.resolverHandoff.combatStartTime)
          })
    },
    // Queries and handlers share canonical copies; caller-owned frozen events remain untouched.
    events: validated.events
      .filter((event) => event.schedulerBoonPrediction !== true)
      .map((event) => normalizeBoonDuration(canonicalEvent({ ...event })))
  };
  if (!profession?.id) throw new TypeError('GW2 timeline resolver requires a profession.');
  // Assemble common mechanics once so queries, handlers, and runtime callbacks share the same reactions.
  const reactions = createGw2ResolverReactionRegistry({
    professionReactions: profession.eventReactions,
    contributions: createGw2EquipmentReactionContributions()
  });
  const resolvedTimelineEvents: Gw2ResolverEvent[] = [];
  const query =
    queryOverride ??
    createGw2CombatQuery({
      profession,
      config,
      events: scheduled.events,
      resolvedTimelineEvents,
      traits
    });
  const hits = createGw2HitResolution({ strikeMultiplier: relicStrikeMultiplier });
  const conditions = createGw2ConditionResolution({ config, reactions: reactions });
  const commonHandlers = createGw2ResolverEventHandlers({
    hitResolution: hits,
    conditions,
    reactions: reactions
  });
  const resolutionEndTime = Number(scheduled.resolutionEndTime ?? scheduled.rotationEndTime);
  const queue = new StableEventQueue(scheduled.events as Gw2ResolverEvent[], { phaseFor: gw2ResolverPhase });
  const handoff = scheduled.resolverHandoff;
  const ctx = createGw2ResolverRuntimeState({
    reporting: output !== 'score',
    damageDiagnostics,
    config,
    traits,
    horizon: resolutionEndTime,
    query,
    helpers: helpers ?? {
      conditionName: canonicalTargetConditionName,
      skillsById: profession.catalog?.skillsById || new Map(),
      skillsByName: profession.catalog?.skillsByName || new Map(),
      balanceProfilesById: profession.catalog?.balanceProfilesById || new Map()
    },
    queue,
    // Resolution always starts at time zero; scheduler mutations arrive through chronological events.
    professionState:
      typeof profession.createResolverState === 'function'
        ? profession.createResolverState(config)
        : profession.createProfessionState(config),
    warnings: [...(handoff.warnings || [])],
    applyCondition: conditions.applyCondition,
    onFirstDamage: conditions.startDamageClock,
    reactions: reactions
  });
  if (handoff.hasExplicitCombatStart) {
    ctx.combatStartTime = handoff.combatStartTime;
  }

  // Ambient target conditions join the queue only after the explicit combat
  // boundary is known, so they cannot create a player combat-start window.
  conditions.initializeEnvironment(ctx);
  recordPassiveRelicTimeline(ctx, scheduled.events, resolutionEndTime);

  for (const event of scheduled.events) {
    if (event.type === 'proc') {
      ctx.recordProc(
        event.procType || 'proc',
        event.name || String(event.sourceId),
        event.at,
        event.sourceSkill,
        event.detail,
        event.icon,
        event.cooldownReduction,
        // Scheduler-owned timed procs use the same deadline contract as resolver-owned relic buffs.
        Number(event.duration) > 0 ? event.at + Number(event.duration) : null
      );
    }
  }

  const registry = createGw2ResolverHandlerRegistry({
    commonHandlers,
    professionHandlers: profession.eventHandlers
  });
  runGw2ResolverEventLoop(ctx, registry, resolvedTimelineEvents);

  const resolvedAt = onPhase ? performance.now() : 0;
  onPhase?.('resolution', resolvedAt - started);
  const result = buildResolverResult(ctx, scheduled, handoff);
  onPhase?.('reporting', performance.now() - resolvedAt);
  return result;
}
