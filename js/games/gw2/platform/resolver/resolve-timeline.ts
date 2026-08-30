import { EPSILON } from '#kernel/core/clock.js';
import { createEventQueue } from '#kernel/events/queue.js';
import { assertScheduledEventStream as assertPlatformStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { createGw2ResolverHandlerRegistry, runGw2ResolverEventLoop } from '#gw2/platform/resolver/event-loop.js';
import { playerDamageTotal } from '#gw2/platform/combat/state/target-health.js';

import type {
  Gw2ResolverEvent,
  Gw2ResolverResult,
  Gw2ResolverRuntime,
  ResolveGw2TimelineOptions
} from '#gw2/platform/resolver/types.js';

interface Gw2ResolverHandoff {
  readonly warnings?: readonly string[];
  readonly hasExplicitCombatStart?: boolean;
  readonly combatStartTime?: number | null;
}

interface CastCount {
  readonly name: string;
  count: number;
}

function addCastsToBreakdown(
  ctx: Gw2ResolverRuntime,
  events: readonly Gw2ResolverEvent[],
  effectiveEnd: number
): Map<string, CastCount> {
  const countsById = new Map<string, number>();
  const output = new Map<string, CastCount>();
  for (const event of events) {
    if (event.type !== 'action' || event.at > effectiveEnd + EPSILON) continue;
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
  handoff: Readonly<Gw2ResolverHandoff>
): Gw2ResolverResult {
  const totalDamage = playerDamageTotal(ctx);
  const effectiveEnd = ctx.deathTime ?? ctx.horizon;
  const effectiveEvents = scheduled.events.filter((event) => event.at <= effectiveEnd + EPSILON) as Gw2ResolverEvent[];
  const casts = addCastsToBreakdown(ctx, effectiveEvents, effectiveEnd);
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

  return {
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
    warnings: [...new Set(ctx.warnings)],
    casts: [...casts.values()]
      .map(({ name, count }) => ({ name, count }))
      .sort((left, right) => right.count - left.count),
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
export function resolveGw2Timeline({
  stream,
  config,
  traits,
  query,
  helpers,
  createRuntimeState,
  commonHandlers,
  reactions,
  beforeResolveTimeline,
  initializeEnvironment,
  professionHandlers = {},
  professionState = {},
  eventFilterState = {},
  shouldSkipEvent
}: ResolveGw2TimelineOptions): Gw2ResolverResult {
  if (typeof createRuntimeState !== 'function') {
    throw new TypeError('GW2 timeline resolver requires createRuntimeState.');
  }

  const scheduled = assertPlatformStream(stream);
  const resolutionEndTime = Number(scheduled.resolutionEndTime ?? scheduled.rotationEndTime);
  const queue = createEventQueue(scheduled.events.map((event) => ({ ...event }) as Gw2ResolverEvent));
  const handoff = scheduled.resolverHandoff as Readonly<Gw2ResolverHandoff>;
  const ctx = createRuntimeState({
    config,
    traits,
    horizon: resolutionEndTime,
    query,
    helpers,
    queue,
    professionState,
    eventFilterState,
    warnings: [...(handoff.warnings || [])],
    reactions
  });
  if (handoff.hasExplicitCombatStart) {
    ctx.combatStartTime = handoff.combatStartTime;
  }

  // Ambient target conditions join the queue only after the explicit combat
  // boundary is known, so they cannot create a player combat-start window.
  initializeEnvironment(ctx);
  beforeResolveTimeline(ctx, scheduled.events, resolutionEndTime);

  for (const event of scheduled.events) {
    if (event.type === 'proc') {
      ctx.recordProc(
        event.procType || 'proc',
        event.name || String(event.sourceId),
        event.at,
        event.sourceSkill,
        event.detail,
        event.icon,
        event.cooldownReduction
      );
    }
  }

  const registry = createGw2ResolverHandlerRegistry({
    commonHandlers,
    professionHandlers
  });
  runGw2ResolverEventLoop(ctx, registry, { shouldSkipEvent });

  return buildResolverResult(ctx, scheduled, handoff);
}
