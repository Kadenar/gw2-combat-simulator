import { EPSILON, isInternalCooldownReady } from "../../engine/clock.js";
import { enqueueOrdered } from "../../engine/event-queue.js";
import type { SchedulerRecord } from "../../engine/types.js";
import { isGw2PlayerActorEvent } from "../event-ownership.js";
import { FOOD_DATA, NOURISHMENT_ICON } from "../gear-data.js";
import {
  handleBlastComboRelic,
  handleBoonRelics,
  handleConditionRelics,
  handleControlRelics,
  handlePeithaRelic,
  handleRelicDamageResolved,
  handleRelicsAfterHit,
  handleWeaknessVulnerabilityRelic,
} from "../relic-rules.js";
import { skillForEvent } from "./event-skill.js";

import type {
  Gw2ApplyCondition,
  Gw2ConditionResolution,
  Gw2HitResolutionContext,
  Gw2ResolverEvent,
  Gw2ResolverReactionContributions,
  Gw2ResolverReactionRegistry,
  Gw2ResolverRuntime,
} from "../types.js";

export const GW2_REACTION_ORDER = Object.freeze({
  EARLY_COMMON: -200,
  COMMON: -100,
  PROFESSION: 0,
  LATE_COMMON: 100,
  FINAL_COMMON: 200,
});

type Dispatch = Gw2ResolverReactionRegistry["dispatch"];

function conditionHelpers(
  details: SchedulerRecord,
): {
  activeConditionStackCount: Gw2ConditionResolution["activeConditionStackCount"];
  applyCondition: Gw2ApplyCondition;
} {
  const activeConditionStackCount =
    details.activeConditionStackCount as Gw2ConditionResolution["activeConditionStackCount"];
  const applyCondition =
    details.applyCondition as Gw2ConditionResolution["applyCondition"];
  return {
    activeConditionStackCount,
    applyCondition: (context, event) =>
      applyCondition(context as Gw2ResolverRuntime, event),
  };
}

function handleCriticalFood(
  dispatch: Dispatch,
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details: SchedulerRecord,
): void {
  const hitContext = details.hitContext as Gw2HitResolutionContext;
  if (!isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0)) return;
  const proc = FOOD_DATA[String(ctx.config.food || "")]?.proc;
  if (proc?.type !== "critStrike" || hitContext.critical.chance <= 0) return;

  if (ctx.random.stochastic) {
    if (
      hitContext.critical.didCrit !== true ||
      !isInternalCooldownReady(event.at, ctx.food.readyAt) ||
      !ctx.random.roll(proc.chance, "food.critical-strike")
    ) {
      return;
    }
  } else {
    ctx.food.criticalProgress += hitContext.critical.chance * proc.chance;
    if (ctx.food.criticalProgress < 1 - EPSILON) return;
    if (!isInternalCooldownReady(event.at, ctx.food.readyAt)) return;
    ctx.food.criticalProgress -= 1;
  }
  ctx.food.readyAt = event.at + Number(proc.icdMs || 0) / 1000;
  const foodEvent = {
    type: "damage",
    at: event.at,
    name: proc.name,
    skillName: proc.name,
    coefficient: 0,
    flatDamage: proc.flatDamage,
    lifeSiphon: true,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Food",
    sourceId: `food.${String(proc.name || "proc").toLowerCase()}`,
    actorType: "effect",
    noCrit: true,
    triggeredBy: event.skillName,
  } as Gw2ResolverEvent;
  const professionUpdates = dispatch(
    "food-proc.created",
    ctx,
    foodEvent,
    { proc, triggeringEvent: event },
  ) || {};
  enqueueOrdered(ctx.queue, { ...foodEvent, ...professionUpdates });
  ctx.recordProc(
    "food",
    proc.name,
    event.at,
    event.skillName,
    "",
    NOURISHMENT_ICON,
  );
}

/** Resolver-time equipment hooks. Scheduler-owned sigil generation stays out. */
export function createGw2EquipmentReactionContributions({
  dispatch,
}: {
  readonly dispatch: Dispatch;
}): Gw2ResolverReactionContributions {
  return Object.freeze({
    "blast-combo.resolved": [{
      id: "relic.blast-combo",
      order: GW2_REACTION_ORDER.COMMON,
      handler: (ctx, event) => handleBlastComboRelic(ctx, event),
    }],
    "buff.applied": [{
      id: "sigil.severance",
      order: GW2_REACTION_ORDER.EARLY_COMMON,
      handler(ctx, event) {
        if (String(event.kind || "").toLowerCase() !== "sigil-severance") return;
        ctx.sigil.severanceUntil = Math.max(
          ctx.sigil.severanceUntil,
          event.at + Math.max(0, Number(event.duration || 0)),
        );
      },
    }, {
      id: "relic.boon",
      order: GW2_REACTION_ORDER.COMMON,
      handler: (ctx, event) => handleBoonRelics(ctx, event),
    }],
    "damage.resolved": [{
      id: "relic.damage-resolved",
      order: GW2_REACTION_ORDER.COMMON,
      handler: (ctx, event) => handleRelicDamageResolved(ctx, event),
    }, {
      id: "food.critical-strike",
      order: GW2_REACTION_ORDER.LATE_COMMON,
      handler: (ctx, event, details = {}) =>
        handleCriticalFood(dispatch, ctx, event, details),
    }, {
      id: "relic.after-hit",
      order: GW2_REACTION_ORDER.FINAL_COMMON,
      handler: (ctx, event) =>
        handleRelicsAfterHit(ctx, event, skillForEvent(ctx.helpers, event)),
    }],
    "condition.applied": [{
      id: "relic.condition",
      order: GW2_REACTION_ORDER.LATE_COMMON,
      handler(ctx, application, details = {}) {
        handleConditionRelics(
          ctx,
          application,
          conditionHelpers(details),
        );
      },
    }],
    "control.resolved": [{
      id: "relic.control",
      order: GW2_REACTION_ORDER.COMMON,
      handler(ctx, event, details = {}) {
        handleControlRelics(ctx, event, conditionHelpers(details));
      },
    }],
    "peitha.resolved": [{
      id: "relic.peitha",
      order: GW2_REACTION_ORDER.COMMON,
      handler(ctx, event, details = {}) {
        handlePeithaRelic(
          ctx,
          event,
          conditionHelpers(details).applyCondition,
        );
      },
    }],
    "weakness-vulnerability.resolved": [{
      id: "relic.weakness-vulnerability",
      order: GW2_REACTION_ORDER.COMMON,
      handler: (ctx, event) =>
        handleWeaknessVulnerabilityRelic(ctx, event),
    }],
  });
}
