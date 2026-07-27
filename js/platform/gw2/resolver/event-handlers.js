import { EPSILON } from "../../engine/clock.js";
import { enqueueOrdered } from "../../engine/event-queue.js";
import {
  isInternalCooldownReady,
} from "../../engine/internal-cooldown.js";
import {
  FOOD_DATA,
  NOURISHMENT_ICON,
} from "../gear-data.js";
import {
  applyMistStranger,
  handleControlRelics,
  handlePeithaRelic,
  handleRelicsAfterHit,
} from "../relic-rules.js";
import {
  GW2_EVENT_ACTOR_TYPES,
  gw2EventActorType,
  isGw2PlayerActorEvent,
} from "../event-ownership.js";

const noop = () => {};

function reactionFor(reactions, eventType) {
  return reactions?.[eventType] || noop;
}

function handleBuff(ctx, event, eventReactions) {
  const kind = String(event.kind || "").toLowerCase();
  const applications = ctx.boons.get(kind) || [];
  applications.push({
    at: event.at,
    expiresAt: event.at + Math.max(0, Number(event.duration || 0)),
    stacks: Math.max(1, Number(event.stacks || 1)),
  });
  ctx.boons.set(kind, applications);
  const activeStacks = applications
    .filter(application => application.expiresAt > event.at)
    .reduce((sum, application) => sum + application.stacks, 0);
  if (kind === "sigil-severance") {
    ctx.sigil.severanceUntil = Math.max(
      ctx.sigil.severanceUntil,
      event.at + Math.max(0, Number(event.duration || 0)),
    );
  }
  reactionFor(eventReactions, "buff")(ctx, event, {
    activeStacks,
    applications,
  });
}

function requireFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`GW2 resolver handlers require ${name}.`);
  }
  return value;
}

function triggeringSkill(ctx, event) {
  return (
    ctx.helpers.skillsById?.get(event.skillId ?? event.sourceId)
    ?? ctx.helpers.skillsByName?.get(event.skillName)
  );
}

function handleCriticalFood(ctx, event, hitContext) {
  if (!isGw2PlayerActorEvent(event) || !(event.coefficient > 0)) return;
  const proc = FOOD_DATA[ctx.config.food]?.proc;
  if (
    proc?.type !== "critStrike"
    || hitContext.critical.chance <= 0
  ) return;

  ctx.food.criticalProgress += hitContext.critical.chance * proc.chance;
  if (ctx.food.criticalProgress < 1 - EPSILON) return;
  if (!isInternalCooldownReady(event.at, ctx.food.readyAt)) return;

  ctx.food.criticalProgress -= 1;
  ctx.food.readyAt = event.at + Number(proc.icdMs || 0) / 1000;
  enqueueOrdered(ctx.queue, {
    type: "damage",
    at: event.at,
    name: proc.name,
    skillName: proc.name,
    coefficient: 0,
    flatDamage: proc.flatDamage,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Food",
    sourceId: `food.${String(proc.name || "proc").toLowerCase()}`,
    actorType: "effect",
    noCrit: true,
    triggeredBy: event.skillName,
  });
  ctx.recordProc(
    "food",
    proc.name,
    event.at,
    event.skillName,
    "",
    NOURISHMENT_ICON,
  );
}

function markCombatActive(ctx, event) {
  const actorType = gw2EventActorType(event);
  if (
    actorType === GW2_EVENT_ACTOR_TYPES.PLAYER
    || actorType === GW2_EVENT_ACTOR_TYPES.SUMMON
  ) {
    ctx.combatActive = true;
  }
}

/**
 * Builds the complete standard GW2 numeric resolver handler set.
 *
 * Event-generating sigil decisions are materialized by the shared GW2
 * scheduler policy. The resolver only consumes their canonical events.
 */
export function createGw2ResolverEventHandlers({
  hitResolution,
  conditions,
  eventReactions = {},
} = {}) {
  const buildHitResolutionContext = requireFunction(
    hitResolution?.buildContext,
    "hitResolution.buildContext",
  );
  const applyResolvedHit = requireFunction(
    hitResolution?.apply,
    "hitResolution.apply",
  );
  const activeConditionStackCount = requireFunction(
    conditions?.activeStackCount,
    "conditions.activeStackCount",
  );
  const applyCondition = requireFunction(
    conditions?.apply,
    "conditions.apply",
  );
  const handleConditionTick = requireFunction(
    conditions?.tick,
    "conditions.tick",
  );

  return Object.freeze({
    action: noop,
    combat_start(ctx) {
      ctx.combatActive = true;
    },
    marker: noop,
    proc: noop,
    resource: noop,
    buff(ctx, event) {
      handleBuff(ctx, event, eventReactions);
    },
    weakness_vulnerability: noop,

    damage(ctx, event) {
      markCombatActive(ctx, event);
      const hitContext = buildHitResolutionContext(ctx, event);
      applyResolvedHit(ctx, event, hitContext);
      applyMistStranger(ctx, event);
      reactionFor(eventReactions, "damage")(ctx, event, {
        hitContext,
        applyCondition,
      });
      handleCriticalFood(ctx, event, hitContext);
      handleRelicsAfterHit(ctx, event, triggeringSkill(ctx, event));
    },

    condition(ctx, event) {
      markCombatActive(ctx, event);
      applyCondition(ctx, event);
    },

    condition_tick(ctx, event) {
      const resolved = handleConditionTick(ctx, event);
      reactionFor(eventReactions, "condition_tick")(ctx, event, { resolved });
    },

    control(ctx, event) {
      markCombatActive(ctx, event);
      handleControlRelics(ctx, event, {
        activeConditionStackCount,
        applyCondition,
      });
      reactionFor(eventReactions, "control")(ctx, event, { applyCondition });
    },

    blind(ctx, event) {
      markCombatActive(ctx, event);
      reactionFor(eventReactions, "blind")(ctx, event, { applyCondition });
    },

    peitha(ctx, event) {
      handlePeithaRelic(ctx, event, applyCondition);
      reactionFor(eventReactions, "peitha")(ctx, event, { applyCondition });
    },

    weapon_set(ctx, event) {
      ctx.activeWeaponSet = Number(event.weaponSet) === 2 ? 2 : 1;
      reactionFor(eventReactions, "weapon_set")(ctx, event, { applyCondition });
    },

    sigil_swap: noop,
  });
}
