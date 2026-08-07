import { professionCoreState } from "../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import {
  CANONICAL_TARGET_CONDITIONS,
} from "../../../platform/gw2/target-state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import type { SkillId } from "../../../platform/engine/types.js";
import type {
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefResolverReactionDetails,
} from "../types.js";

function handleThiefState(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
): void {
  const incoming = structuredClone(event.state || {}) as Record<string, unknown>;
  const core = professionCoreState(context) as unknown as Record<string, unknown>;
  const specialization = context.profession.specialization.state as unknown as Record<string, unknown>;
  const ownerFor = (key: string): Record<string, unknown> =>
    Object.hasOwn(specialization, key) ? specialization : core;
  const preserved: Record<string, unknown> = {
    traitProcReadyAt: core.traitProcReadyAt || {},
  };
  for (const generationField of Object.keys(incoming).filter(
    key => key.endsWith("Generation"),
  )) {
    const prefix = generationField.slice(0, -"Generation".length);
    const chargesField = `${prefix}Charges`;
    const expiresAtField = `${prefix}ExpiresAt`;
    const owner = ownerFor(generationField);
    if (
      Number(incoming[generationField] || 0)
        === Number(owner[generationField] || 0)
      && Number(incoming[expiresAtField] || 0) > event.at
      && Object.hasOwn(owner, chargesField)
    ) {
      preserved[chargesField] = owner[chargesField] || 0;
    }
  }
  for (const [key, value] of Object.entries(incoming)) {
    ownerFor(key)[key] = value;
  }
  for (const [key, value] of Object.entries(preserved)) {
    ownerFor(key)[key] = value;
  }
}

export const thiefCoreResolverEventHandlers = Object.freeze({
  "thief.state": handleThiefState,
});

function enqueueSiphon(context: ThiefResolverContext, event: ThiefResolverEvent, {
  sourceId,
  name,
  coefficient,
}: {
  readonly sourceId: SkillId;
  readonly name: string;
  readonly coefficient: number;
}): void {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: sourceId,
    skillName: name,
    name,
    coefficient,
    hits: 1,
    canCrit: false,
    noCrit: true,
    lifeSiphon: true,
    triggeredBy: event.skillName,
  });
}

function applySpiderVenom(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {},
): void {
  if (
    event.actorType !== "player"
    || !(Number(event.coefficient) > 0)
  ) return;
  const state = professionCoreState(context);
  if (
    Number(state.spiderVenomCharges || 0) <= 0
    || Number(state.spiderVenomExpiresAt || 0) <= event.at
  ) return;
  state.spiderVenomCharges -= 1;
  details.applyCondition?.(context, {
    type: "condition",
    at: event.at,
    source: "thief",
    sourceId: ID.SPIDER_VENOM,
    actorType: "player",
    skillId: ID.SPIDER_VENOM,
    skillName: "Spider Venom",
    name: "Spider Venom - Poison",
    condition: "Poisoned",
    stacks: 1,
    duration: 3,
    activationId:
      event.activationId || `${event.skillId}:${event.at}`,
    triggeredBy: event.skillName,
  });
  if (hasThiefTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    enqueueSiphon(context, event, {
      sourceId: TRAIT.LEECHING_VENOMS,
      name: "Leeching Venoms",
      coefficient: 0.033,
    });
  }
}

function applyShadowSiphoning(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
): void {
  if (
    event.actorType !== "player"
    || !(Number(event.coefficient) > 0)
    || !hasThiefTrait(context.config, TRAIT.SHADOW_SIPHONING)
  ) return;
  const skill = event.skillId == null
    ? undefined
    : context.helpers.skillsById?.get(event.skillId);
  const namedSkill = event.skillName == null
    ? undefined
    : context.helpers.skillsByName?.get(event.skillName);
  if (!(skill || namedSkill)?.stealthAttack) return;
  const state = professionCoreState(context);
  const readyAt = Number(
    state.traitProcReadyAt[TRAIT.SHADOW_SIPHONING] || 0,
  );
  if (event.at + 1e-9 < readyAt) return;
  state.traitProcReadyAt[TRAIT.SHADOW_SIPHONING] = event.at + 1;
  enqueueSiphon(context, event, {
    sourceId: TRAIT.SHADOW_SIPHONING,
    name: "Shadow Siphoning",
    coefficient: 0.1,
  });
}

function targetConditionCount(context: ThiefResolverContext, at: number): number {
  return CANONICAL_TARGET_CONDITIONS.filter(condition =>
    context.query?.targetHasCondition(
      condition,
      at,
      context,
    )).length;
}

function applyPanicStrike(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {},
): void {
  if (
    event.actorType !== "player"
    || !(Number(event.coefficient) > 0)
    || !hasThiefTrait(context.config, TRAIT.PANIC_STRIKE)
    || targetConditionCount(context, event.at) < 3
  ) return;
  const state = professionCoreState(context);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.PANIC_STRIKE] || 0);
  if (event.at + 1e-9 < readyAt) return;
  state.traitProcReadyAt[TRAIT.PANIC_STRIKE] = event.at + 20;
  details.applyCondition?.(context, {
    type: "condition",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.PANIC_STRIKE,
    actorType: "player",
    skillId: TRAIT.PANIC_STRIKE,
    skillName: "Panic Strike",
    name: "Panic Strike - Immobilized",
    condition: "Immobilized",
    stacks: 1,
    duration: 2.5,
    activationId: `panic-strike:${event.at}`,
    triggeredBy: event.skillName,
  });
}

function applyThiefDamageReactions(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {},
): void {
  applySpiderVenom(context, event, details);
  applyShadowSiphoning(context, event);
  applyPanicStrike(context, event, details);
}

function applyThiefConditionReactions(
  context: ThiefResolverContext,
  application: ThiefResolverEvent,
): void {
  if (
    application.condition === "Poisoned"
    && application.skillId === ID.SPIDER_VENOM
    && application.triggeredByAlly
    && hasThiefTrait(context.config, TRAIT.LEECHING_VENOMS)
  ) {
    enqueueSiphon(context, application, {
      sourceId: TRAIT.LEECHING_VENOMS,
      name: "Leeching Venoms",
      coefficient: 0.033,
    });
  }
  if (
    application.condition === "Immobilized"
    && application.actorType === "player"
    && hasThiefTrait(context.config, TRAIT.PANIC_STRIKE)
  ) {
    enqueueOrdered(context.queue, {
      type: "condition",
      at: application.at,
      source: "Trait",
      sourceId: TRAIT.PANIC_STRIKE,
      actorType: "player",
      skillId: TRAIT.PANIC_STRIKE,
      skillName: "Panic Strike",
      name: "Panic Strike - Poison",
      condition: "Poisoned",
      stacks: hasThiefTrait(context.config, TRAIT.POTENT_POISON) ? 2 : 1,
      duration: 4,
      activationId:
        application.activationId || `panic-strike:${application.at}`,
      triggeredBy: application.skillName,
    });
  }
  if (
    application.condition === "Blindness"
    && hasThiefTrait(context.config, TRAIT.CLOAKED_IN_SHADOW)
  ) {
    enqueueSiphon(context, application, {
      sourceId: TRAIT.CLOAKED_IN_SHADOW,
      name: "Cloaked in Shadow",
      coefficient: 0.04,
    });
  }
  if (
    application.condition === "Bleeding"
    && Number(application.bonusAboveNinetyStacks || 0) > 0
  ) {
    const maximum = Number(context.config?.target?.health || 0);
    const damage =
      Number(context.totals?.strike || 0)
      + Number(context.totals?.condition || 0);
    if (!(maximum > 0) || damage / maximum < 0.1) {
      enqueueOrdered(context.queue, {
        ...application,
        type: "condition",
        name: "Unsuspecting Strike - Bonus Bleeding",
        condition: application.condition,
        duration: Number(application.duration || 0),
        stacks: Number(application.bonusAboveNinetyStacks),
        bonusAboveNinetyStacks: 0,
      });
    }
  }
}

export const thiefCoreResolverEventReactions = Object.freeze({
  damage: applyThiefDamageReactions,
  condition: applyThiefConditionReactions,
});
