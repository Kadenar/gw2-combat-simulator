import { EPSILON } from "../../engine/clock.js";
import { enqueueOrdered } from "../../engine/event-queue.js";
import { isInternalCooldownReady } from "../../engine/internal-cooldown.js";
import { FOOD_DATA, NOURISHMENT_ICON } from "../gear-data.js";
import {
  handleBlastComboRelic,
  handleBoonRelics,
  handleControlRelics,
  handlePeithaRelic,
  handleRelicDamageResolved,
  handleRelicsAfterHit,
} from "../relic-rules.js";
import {
  GW2_EVENT_ACTOR_TYPES,
  gw2EventActorType,
  isGw2PlayerActorEvent,
} from "../event-ownership.js";

import type { Skill } from "../../engine/types.js";
import type {
  Gw2ApplyCondition,
  Gw2ConditionResolution,
  Gw2HitResolution,
  Gw2HitResolutionContext,
  Gw2ResolverEvent,
  Gw2ResolverEventHandlers,
  Gw2ResolverReaction,
  Gw2ResolverReactions,
  Gw2ResolverRuntime,
} from "../types.js";

interface CreateGw2ResolverEventHandlersOptions {
  readonly hitResolution?: {
    readonly buildContext?: Gw2HitResolution["buildHitResolutionContext"];
    readonly apply?: Gw2HitResolution["applyResolvedHit"];
  };
  readonly conditions?: {
    readonly activeStackCount?: Gw2ConditionResolution["activeConditionStackCount"];
    readonly apply?: Gw2ConditionResolution["applyCondition"];
    readonly tick?: Gw2ConditionResolution["handleConditionTick"];
  };
  readonly eventReactions?: Gw2ResolverReactions;
}

const noop: Gw2ResolverReaction = () => {};

function reactionFor(
  reactions: Gw2ResolverReactions,
  eventType: string,
): Gw2ResolverReaction {
  // Missing profession reactions are intentionally valid; the shared handler
  // still performs the numeric/state work for that event.
  return reactions?.[eventType] || noop;
}

function handleBuff(
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  eventReactions: Gw2ResolverReactions,
): void {
  const kind = String(event.kind || "").toLowerCase();
  const applications = ctx.boons.get(kind) || [];
  applications.push({
    at: event.at,
    expiresAt: event.at + Math.max(0, Number(event.duration || 0)),
    stacks: Math.max(1, Number(event.stacks || 1)),
  });
  ctx.boons.set(kind, applications);
  // Keep expired applications for historical timestamp queries, but report
  // only stacks active immediately after this application.
  const activeStacks = applications
    .filter((application) => application.expiresAt > event.at)
    .reduce((sum, application) => sum + application.stacks, 0);
  if (kind === "sigil-severance") {
    ctx.sigil.severanceUntil = Math.max(
      ctx.sigil.severanceUntil,
      event.at + Math.max(0, Number(event.duration || 0)),
    );
  }
  handleBoonRelics(ctx, event);
  reactionFor(eventReactions, "buff")(ctx, event, {
    activeStacks,
    applications,
  });
}

function requireFunction(
  value: unknown,
  name: string,
): (...args: never[]) => unknown {
  if (typeof value !== "function") {
    throw new TypeError(`GW2 resolver handlers require ${name}.`);
  }
  return value as (...args: never[]) => unknown;
}

function triggeringSkill(
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): Skill | undefined {
  // Scheduled events normally carry an id; name lookup supports older streams
  // and generated events whose source id is not a catalog skill id.
  return (
    ctx.helpers.skillsById?.get(event.skillId ?? event.sourceId) ??
    ctx.helpers.skillsByName?.get(event.skillName || "")
  );
}

function handleCriticalFood(
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  hitContext: Gw2HitResolutionContext,
  eventReactions: Gw2ResolverReactions,
): void {
  if (!isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0)) return;
  const proc = FOOD_DATA[String(ctx.config.food || "")]?.proc;
  if (proc?.type !== "critStrike" || hitContext.critical.chance <= 0) return;

  // Expected-value procs use a deterministic accumulator. A 25% expected proc
  // contributes 0.25 per eligible hit and fires whenever progress reaches one.
  ctx.food.criticalProgress += hitContext.critical.chance * proc.chance;
  if (ctx.food.criticalProgress < 1 - EPSILON) return;
  // Progress is retained while the ICD is closed, so the next eligible hit can
  // consume the proc instead of discarding accumulated expected probability.
  if (!isInternalCooldownReady(event.at, ctx.food.readyAt)) return;

  ctx.food.criticalProgress -= 1;
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
  const professionUpdates =
    reactionFor(eventReactions, "food_proc")(ctx, foodEvent, {
      proc,
      triggeringEvent: event,
    }) || {};
  enqueueOrdered(ctx.queue, {
    ...foodEvent,
    ...professionUpdates,
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

function markCombatActive(
  ctx: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  const actorType = gw2EventActorType(event);
  // Player and summon output starts combat. Passive equipment/food effects do
  // not bootstrap combat by themselves.
  if (
    actorType === GW2_EVENT_ACTOR_TYPES.PLAYER ||
    actorType === GW2_EVENT_ACTOR_TYPES.SUMMON
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
}: CreateGw2ResolverEventHandlersOptions = {}): Gw2ResolverEventHandlers {
  const buildHitResolutionContext = requireFunction(
    hitResolution?.buildContext,
    "hitResolution.buildContext",
  ) as Gw2HitResolution["buildHitResolutionContext"];
  const applyResolvedHit = requireFunction(
    hitResolution?.apply,
    "hitResolution.apply",
  ) as Gw2HitResolution["applyResolvedHit"];
  const activeConditionStackCount = requireFunction(
    conditions?.activeStackCount,
    "conditions.activeStackCount",
  ) as Gw2ConditionResolution["activeConditionStackCount"];
  const applyCondition = requireFunction(
    conditions?.apply,
    "conditions.apply",
  ) as Gw2ConditionResolution["applyCondition"];
  const handleConditionTick = requireFunction(
    conditions?.tick,
    "conditions.tick",
  ) as Gw2ConditionResolution["handleConditionTick"];
  const applyRelicCondition: Gw2ApplyCondition = (context, event) =>
    applyCondition(context as Gw2ResolverRuntime, event);

  const handlers: Gw2ResolverEventHandlers = {
    // These event types are canonical timeline/reporting records with no shared
    // numeric effect. Keeping explicit handlers prevents them being mistaken
    // for unsupported required events by the resolver loop.
    action: noop,
    combat_start(ctx) {
      ctx.combatActive = true;
    },
    marker: noop,
    proc: noop,
    resource: noop,
    blast_combo(ctx, event) {
      handleBlastComboRelic(ctx, event);
    },
    buff(ctx, event) {
      handleBuff(ctx, event, eventReactions);
    },
    weakness_vulnerability: noop,

    damage(ctx, event) {
      markCombatActive(ctx, event);
      const hitContext = buildHitResolutionContext(ctx, event);
      // Ordering matters: apply the base hit first, then profession reactions,
      // expected food procs, and finally relic after-hit rules.
      applyResolvedHit(ctx, event, hitContext);
      handleRelicDamageResolved(ctx, event);
      reactionFor(eventReactions, "damage")(ctx, event, {
        hitContext,
        applyCondition,
      });
      handleCriticalFood(ctx, event, hitContext, eventReactions);
      handleRelicsAfterHit(ctx, event, triggeringSkill(ctx, event));
    },

    condition(ctx, event) {
      markCombatActive(ctx, event);
      // applyCondition schedules future tick events; it does not charge the
      // condition's full damage at application time.
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
        applyCondition: applyRelicCondition,
      });
      reactionFor(eventReactions, "control")(ctx, event, { applyCondition });
    },

    blind(ctx, event) {
      markCombatActive(ctx, event);
      reactionFor(eventReactions, "blind")(ctx, event, { applyCondition });
    },

    peitha(ctx, event) {
      handlePeithaRelic(ctx, event, applyRelicCondition);
      reactionFor(eventReactions, "peitha")(ctx, event, { applyCondition });
    },

    weapon_set(ctx, event) {
      // Invalid/missing values normalize to set one so later sigil and weapon
      // queries always have a valid one-based set number.
      ctx.activeWeaponSet = Number(event.weaponSet) === 2 ? 2 : 1;
      reactionFor(eventReactions, "weapon_set")(ctx, event, { applyCondition });
    },

    sigil_swap: noop,
  };
  return Object.freeze(handlers);
}
