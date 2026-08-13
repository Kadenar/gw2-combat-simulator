import { enqueueOrdered } from "../../engine/event-queue.js";
import type { SchedulerRecord } from "../../engine/types.js";
import { isGw2PlayerActorEvent } from "../event-ownership.js";
import { FOOD_DATA, NOURISHMENT_ICON } from "../gear-data.js";
import { onResolvedPlayerCriticalHit } from "../native-mechanics.js";
import { clamp } from "../numeric.js";
import { gw2StatsForWeaponSet } from "../runtime-rules.js";
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

import type { NativeResolvedDamageDetails } from "../native-module-types.js";
import type {
  Gw2ApplyCondition,
  Gw2ConditionResolution,
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

interface CriticalFoodEffect {
  readonly type: "boon" | "condition";
  readonly name: string;
  readonly stacks: number;
  readonly duration: number;
}

interface CriticalFoodProc {
  readonly type: string;
  readonly chance: number;
  readonly icdMs?: number;
  readonly flatDamage?: number;
  readonly name: string;
  readonly dayEffect?: CriticalFoodEffect;
  readonly nightEffect?: CriticalFoodEffect;
}

function conditionHelpers(details: SchedulerRecord): {
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

function criticalFoodProc(
  ctx: Gw2ResolverRuntime,
): CriticalFoodProc | undefined {
  const proc = FOOD_DATA[String(ctx.config.food || "")]?.proc as
    CriticalFoodProc | undefined;
  return proc?.type === "critStrike" ? proc : undefined;
}

function createCriticalFoodEffect(
  dispatch: Dispatch,
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  const proc = criticalFoodProc(ctx);
  if (!proc) return;
  const conditionalEffect =
    ctx.config.timeOfDay === "night" ? proc.nightEffect : proc.dayEffect;
  const commonEvent = {
    at: event.at,
    skillName: proc.name,
    source: "Food",
    sourceId: `food.${String(proc.name || "proc").toLowerCase()}`,
    actorType: "effect",
    triggeredBy: event.skillName,
  } as const;
  let foodEvent: Gw2ResolverEvent;
  if (conditionalEffect?.type === "boon") {
    const name = conditionalEffect.name;
    const sigils = ctx.query.activeSigilSetAt(event.at);
    const stats = gw2StatsForWeaponSet(ctx.config, ctx.activeWeaponSet);
    const bonus =
      Number(stats.concentration || 0) / 1500 +
      Number(stats.boonDurationBonus || 0) / 100 +
      Number(stats.boonDurationBonuses?.[name] || 0) / 100 +
      Number(sigils.boonDurationBonus || 0) / 100;
    foodEvent = {
      ...commonEvent,
      type: "buff",
      name: `${proc.name} — ${name}`,
      kind: name.toLowerCase(),
      stacks: conditionalEffect.stacks,
      duration: conditionalEffect.duration * clamp(1 + bonus, 1, 2),
    } as Gw2ResolverEvent;
  } else if (conditionalEffect?.type === "condition") {
    foodEvent = {
      ...commonEvent,
      type: "condition",
      name: `${proc.name} — ${conditionalEffect.name}`,
      condition: conditionalEffect.name,
      stacks: conditionalEffect.stacks,
      duration: conditionalEffect.duration,
    } as Gw2ResolverEvent;
  } else {
    foodEvent = {
      ...commonEvent,
      type: "damage",
      name: proc.name,
      coefficient: 0,
      flatDamage: proc.flatDamage,
      damageKind: "condition",
      lifeSiphon: true,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      noCrit: true,
    } as Gw2ResolverEvent;
  }
  const professionUpdates =
    dispatch("food-proc.created", ctx, foodEvent, {
      proc,
      triggeringEvent: event,
    }) || {};
  enqueueOrdered(ctx.queue, { ...foodEvent, ...professionUpdates });
  ctx.recordProc(
    "food",
    proc.name,
    event.at,
    event.skillName,
    "",
    String(FOOD_DATA[String(ctx.config.food || "")]?.icon || NOURISHMENT_ICON),
  );
}

/** Resolver-time equipment hooks. Scheduler-owned sigil generation stays out. */
export function createGw2EquipmentReactionContributions({
  dispatch,
}: {
  readonly dispatch: Dispatch;
}): Gw2ResolverReactionContributions {
  const criticalFoodReaction = onResolvedPlayerCriticalHit<
    Gw2ResolverRuntime,
    Gw2ResolverEvent,
    NativeResolvedDamageDetails
  >({
    id: "food.critical-strike",
    chanceOnCriticalHit: (ctx) => criticalFoodProc(ctx)?.chance || 0,
    actorTypes: ["player"],
    when: (ctx, event) =>
      isGw2PlayerActorEvent(event) &&
      Number(event.coefficient) > 0 &&
      criticalFoodProc(ctx) != null,
    expectedProgress: {
      get: (ctx) => ctx.food.criticalProgress,
      set: (ctx, value) => {
        ctx.food.criticalProgress = value;
      },
    },
    internalCooldown: {
      duration: (ctx) => Number(criticalFoodProc(ctx)?.icdMs || 0) / 1000,
      readyAt: (ctx) => ctx.food.readyAt,
      setReadyAt: (ctx, readyAt) => {
        ctx.food.readyAt = readyAt;
      },
    },
    randomStream: "food.critical-strike",
    attribution: { kind: "effect", id: "food.critical-strike" },
    handler: (ctx, event) => createCriticalFoodEffect(dispatch, ctx, event),
  });

  return Object.freeze({
    "blast-combo.resolved": [
      {
        id: "relic.blast-combo",
        order: GW2_REACTION_ORDER.COMMON,
        handler: (ctx, event) => handleBlastComboRelic(ctx, event),
      },
    ],
    "buff.applied": [
      {
        id: "sigil.severance",
        order: GW2_REACTION_ORDER.EARLY_COMMON,
        handler(ctx, event) {
          if (String(event.kind || "").toLowerCase() !== "sigil-severance")
            return;
          ctx.sigil.severanceUntil = Math.max(
            ctx.sigil.severanceUntil,
            event.at + Math.max(0, Number(event.duration || 0)),
          );
        },
      },
      {
        id: "relic.boon",
        order: GW2_REACTION_ORDER.COMMON,
        handler: (ctx, event) => handleBoonRelics(ctx, event),
      },
    ],
    "damage.resolved": [
      {
        id: "relic.damage-resolved",
        order: GW2_REACTION_ORDER.COMMON,
        handler: (ctx, event) => handleRelicDamageResolved(ctx, event),
      },
      {
        id: "food.critical-strike",
        order: GW2_REACTION_ORDER.LATE_COMMON,
        handler(ctx, event, details = {}) {
          criticalFoodReaction.handler(ctx, event, details);
        },
      },
      {
        id: "relic.after-hit",
        order: GW2_REACTION_ORDER.FINAL_COMMON,
        handler: (ctx, event) =>
          handleRelicsAfterHit(ctx, event, skillForEvent(ctx.helpers, event)),
      },
    ],
    "condition.applied": [
      {
        id: "relic.condition",
        order: GW2_REACTION_ORDER.LATE_COMMON,
        handler(ctx, application, details = {}) {
          handleConditionRelics(ctx, application, conditionHelpers(details));
        },
      },
    ],
    "control.resolved": [
      {
        id: "relic.control",
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, event, details = {}) {
          handleControlRelics(ctx, event, conditionHelpers(details));
        },
      },
    ],
    "peitha.resolved": [
      {
        id: "relic.peitha",
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, event, details = {}) {
          handlePeithaRelic(
            ctx,
            event,
            conditionHelpers(details).applyCondition,
          );
        },
      },
    ],
    "weakness-vulnerability.resolved": [
      {
        id: "relic.weakness-vulnerability",
        order: GW2_REACTION_ORDER.COMMON,
        handler: (ctx, event) => handleWeaknessVulnerabilityRelic(ctx, event),
      },
    ],
  });
}
