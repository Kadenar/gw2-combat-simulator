import { EPSILON } from "../../engine/clock.js";
import { createEventQueue } from "../../engine/event-queue.js";
import { assertScheduledEventStream as assertPlatformStream } from "../../engine/scheduled-event-stream.js";
import { recordPassiveRelicTimeline } from "../relic-rules.js";
import {
  createGw2ResolverHandlerRegistry,
  runGw2ResolverEventLoop,
} from "./event-loop.js";

import type {
  Gw2ResolverEvent,
  Gw2ResolverResult,
  Gw2ResolverRuntime,
  ResolveGw2TimelineOptions,
} from "../types.js";

interface Gw2ResolverHandoff {
  readonly warnings?: readonly string[];
  readonly hasExplicitCombatStart?: boolean;
  readonly combatStartTime?: number | null;
}

function addCastsToBreakdown(
  ctx: Gw2ResolverRuntime,
  events: readonly Gw2ResolverEvent[],
  effectiveEnd: number,
): Map<string, number> {
  const casts = new Map<string, number>();
  for (const event of events) {
    if (event.type !== "action" || event.at > effectiveEnd + EPSILON) continue;
    const name = event.name || event.skillName || String(event.sourceId);
    casts.set(name, (casts.get(name) || 0) + 1);
  }
  for (const entry of ctx.breakdown.values()) {
    const sourceSkill = entry.sourceSkill || entry.name;
    entry.casts =
      casts.get(sourceSkill) ||
      casts.get(entry.name) ||
      casts.get(entry.name.split(" — ")[0]) ||
      0;
  }
  return casts;
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
  professionHandlers = {},
  professionState = {},
  eventFilterState = {},
  shouldSkipEvent,
}: ResolveGw2TimelineOptions): Gw2ResolverResult {
  if (typeof createRuntimeState !== "function") {
    throw new TypeError("GW2 timeline resolver requires createRuntimeState.");
  }
  const scheduled = assertPlatformStream(stream);
  const queue = createEventQueue(
    scheduled.events.map((event) => ({ ...event }) as Gw2ResolverEvent),
  );
  const handoff = scheduled.resolverHandoff as Readonly<Gw2ResolverHandoff>;
  const ctx = createRuntimeState({
    config,
    traits,
    horizon: scheduled.rotationEndTime,
    query,
    helpers,
    queue,
    professionState,
    eventFilterState,
    warnings: [...(handoff.warnings || [])],
  });
  if (handoff.hasExplicitCombatStart) {
    ctx.combatStartTime = handoff.combatStartTime;
  }

  recordPassiveRelicTimeline(ctx, scheduled.events, scheduled.rotationEndTime);

  for (const event of scheduled.events) {
    if (event.type === "proc") {
      ctx.recordProc(
        event.procType || "proc",
        event.name || String(event.sourceId),
        event.at,
        event.sourceSkill,
        event.detail,
        event.icon,
        event.cooldownReduction,
      );
    }
  }

  const registry = createGw2ResolverHandlerRegistry({
    commonHandlers,
    professionHandlers,
  });
  runGw2ResolverEventLoop(ctx, registry, { shouldSkipEvent });

  const totalDamage = ctx.totals.strike + ctx.totals.condition;
  const effectiveEnd = ctx.deathTime ?? scheduled.rotationEndTime;
  const effectiveEvents = scheduled.events.filter(
    (event) => event.at <= effectiveEnd + EPSILON,
  ) as Gw2ResolverEvent[];
  const casts = addCastsToBreakdown(ctx, effectiveEvents, effectiveEnd);
  const explicitCombatStart = Number(handoff.combatStartTime || 0);
  // DPS always begins with the first surviving positive damage event. An
  // explicit Combat Start only filters earlier combat events and provides the
  // fallback for a damage-free encounter; it is not itself damage.
  const dpsStart =
    ctx.firstHitTime ??
    (handoff.hasExplicitCombatStart ? explicitCombatStart : 0);
  const dpsWindow = Math.max(0, effectiveEnd - dpsStart);
  const damagePerSecond = (damage: number): number =>
    dpsWindow > 0 ? damage / dpsWindow : 0;

  return {
    duration: scheduled.rotationEndTime,
    dpsStartTime: dpsStart,
    dpsWindow,
    firstHitTime: ctx.firstHitTime,
    lastHitTime: ctx.lastHitTime,
    deathTime: ctx.deathTime,
    totalDamage,
    dps: damagePerSecond(totalDamage),
    strikeDamage: ctx.totals.strike,
    conditionDamage: ctx.totals.condition,
    breakdown: [...ctx.breakdown.values()].sort(
      (left, right) => right.damage - left.damage,
    ),
    conditionBreakdown: [...ctx.conditions.values()]
      .map((entry) => ({
        name: entry.name,
        damage: entry.damage,
        dps: damagePerSecond(entry.damage),
        averageStacks: damagePerSecond(entry.stackSeconds),
      }))
      .sort((left, right) => right.damage - left.damage),
    events: effectiveEvents,
    resolvedEvents: ctx.resolved.sort((left, right) => left.at - right.at),
    procSteps: ctx.procSteps
      .filter((step) => step.start <= Math.round(effectiveEnd * 1000 + 0.1))
      .sort((left, right) => left.start - right.start),
    warnings: [...new Set(ctx.warnings)],
    casts: [...casts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count),
    randomness: {
      mode: ctx.random.mode,
      seed: ctx.random.seed,
    },
    profession: ctx.profession,
  };
}
