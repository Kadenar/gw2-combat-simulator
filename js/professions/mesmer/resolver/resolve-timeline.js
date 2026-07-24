// Timeline resolver: post-scheduler damage calculation
// Converts scheduled events to damage numbers using calculated attributes and condition formulas
// Tracks breakdown by skill/source, applies trait/relic modifiers, produces encounter timeline

import { createRuntimeState } from "./runtime-state.js";
import { runEventLoop } from "./event-loop.js";
import { assertScheduledEventStream } from "../../../platform/engine/compat-scheduled-event-stream.js";
import { EPSILON } from "../../../platform/engine/clock.js";
import { recordPassiveRelicTimeline } from "../../../platform/gw2/relic-rules.js";

// Count number of times each skill was cast in event stream
function addCastsToBreakdown(ctx, events, effectiveEnd) {
  const casts = new Map();
  for (const event of events) {
    if (event.type !== "action" || event.at > effectiveEnd + EPSILON) continue;
    casts.set(event.name, (casts.get(event.name) || 0) + 1);
  }
  for (const entry of ctx.breakdown.values()) {
    entry.casts =
      casts.get(entry.name)
      || casts.get(entry.name.split(" — ")[0])
      || 0;
  }
  return casts;
}

// Main resolver entry point: converts scheduled events to damage breakdown
// Validates event stream format, creates runtime context, drains event queue through handlers
// Records passive relic effects, calculates damage, returns final breakdown with per-skill totals
export function resolveScheduledStream({
  stream,
  config,
  traits,
  query,
  helpers,
}) {
  const scheduled = assertScheduledEventStream(stream);
  const queue = scheduled.events.map(event => ({ ...event }));
  const handoff = scheduled.resolverHandoff || {};
  const ctx = createRuntimeState({
    config,
    traits,
    horizon: scheduled.rotationEndTime,
    query,
    helpers,
    queue,
    cloneDeaths: new Map(handoff.cloneDeaths || []),
    warnings: [...(handoff.warnings || [])],
  });
  if (handoff.hasExplicitCombatStart) {
    ctx.combatStartTime = handoff.combatStartTime;
  }

  recordPassiveRelicTimeline(
    ctx,
    scheduled.events,
    scheduled.rotationEndTime,
  );

  for (const event of scheduled.events) {
    if (event.type === "proc") {
      ctx.recordProc(
        event.procType,
        event.name,
        event.at,
        event.sourceSkill,
        event.detail,
        event.icon,
      );
    }
  }

  runEventLoop(ctx);
  const totalDamage = ctx.totals.strike + ctx.totals.condition;
  const effectiveEnd = ctx.deathTime ?? scheduled.rotationEndTime;
  const effectiveEvents = scheduled.events.filter(
    (event) => event.at <= effectiveEnd + EPSILON,
  );
  const casts = addCastsToBreakdown(ctx, effectiveEvents, effectiveEnd);
  // Builder-mode duration starts when the sequence starts, so its DPS must use
  // that same window. Starting at the first hit inflated short rotations by
  // silently dropping casts and waits before that hit from the denominator.
  // An explicit combat marker remains the opt-in way to exclude precombat time.
  const dpsStart = handoff.hasExplicitCombatStart
    ? Number(handoff.combatStartTime || 0)
    : 0;
  const dpsWindow = Math.max(EPSILON, effectiveEnd - dpsStart);

  return {
    duration: scheduled.rotationEndTime,
    dpsStartTime: dpsStart,
    dpsWindow,
    firstHitTime: ctx.firstHitTime,
    lastHitTime: ctx.lastHitTime,
    deathTime: ctx.deathTime,
    totalDamage,
    dps: totalDamage / dpsWindow,
    strikeDamage: ctx.totals.strike,
    conditionDamage: ctx.totals.condition,
    breakdown: [...ctx.breakdown.values()]
      .sort((a, b) => b.damage - a.damage),
    conditionBreakdown: [...ctx.conditions.values()]
      .map(entry => ({
        name: entry.name,
        damage: entry.damage,
        dps: entry.damage / dpsWindow,
        averageStacks: entry.stackSeconds / dpsWindow,
      }))
      .sort((a, b) => b.damage - a.damage),
    events: effectiveEvents,
    resolvedEvents: ctx.resolved.sort((a, b) => a.at - b.at),
    procSteps: ctx.procSteps
      .filter(step => step.start <= Math.round(effectiveEnd * 1000 + 0.1))
      .sort((a, b) => a.start - b.start),
    warnings: [...new Set(ctx.warnings)],
    casts: [...casts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}
