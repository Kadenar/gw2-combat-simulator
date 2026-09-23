import { buildResolverResult } from '#gw2/platform/results/build-result.js';
import { canonicalEvent, StableEventQueue } from '#kernel/events/queue.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { assertScheduledEventStream as assertPlatformStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import {
  createGw2ResolverHandlerRegistry,
  gw2ResolverPhase,
  runGw2ResolverEventLoop
} from '#gw2/platform/resolver/event-loop.js';
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

import type { Gw2ResolverEvent, Gw2ResolverResult, ResolveGw2TimelineOptions } from '#gw2/platform/resolver/types.js';

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
  sigilDiagnostics,
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
    sigilDiagnostics,
    config,
    traits,
    horizon: resolutionEndTime,
    query,
    helpers: helpers ?? {
      conditionName: canonicalTargetConditionName,
      // Preserve selected-patch diagnostics alongside the same catalog's lookup maps.
      balanceDataContext: profession.catalog?.balanceDataContext,
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
