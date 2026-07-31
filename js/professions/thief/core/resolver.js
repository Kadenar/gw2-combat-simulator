import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import {
  CANONICAL_TARGET_CONDITIONS,
} from "../../../platform/gw2/target-state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasThiefTrait } from "./state.js";

function handleThiefState(context, event) {
  const incoming = structuredClone(event.state || {});
  const preserved = {
    traitProcReadyAt: context.profession.traitProcReadyAt || {},
  };
  for (const generationField of Object.keys(incoming).filter(
    key => key.endsWith("Generation"),
  )) {
    const prefix = generationField.slice(0, -"Generation".length);
    const chargesField = `${prefix}Charges`;
    const expiresAtField = `${prefix}ExpiresAt`;
    if (
      Number(incoming[generationField] || 0)
        === Number(context.profession[generationField] || 0)
      && Number(incoming[expiresAtField] || 0) > event.at
      && Object.hasOwn(context.profession, chargesField)
    ) {
      preserved[chargesField] = context.profession[chargesField] || 0;
    }
  }
  Object.assign(context.profession, incoming, preserved);
}

export const thiefCoreResolverEventHandlers = Object.freeze({
  "thief.state": handleThiefState,
});

function enqueueSiphon(context, event, {
  sourceId,
  name,
  coefficient,
}) {
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

function applySpiderVenom(context, event, details) {
  if (
    event.actorType !== "player"
    || !(Number(event.coefficient) > 0)
  ) return;
  const state = context.profession;
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

function applyShadowSiphoning(context, event) {
  if (
    event.actorType !== "player"
    || !(Number(event.coefficient) > 0)
    || !hasThiefTrait(context.config, TRAIT.SHADOW_SIPHONING)
  ) return;
  const skill =
    context.helpers.skillsById?.get(event.skillId)
    || context.helpers.skillsByName?.get(event.skillName);
  if (!skill?.stealthAttack) return;
  const state = context.profession;
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

function targetConditionCount(context, at) {
  return CANONICAL_TARGET_CONDITIONS.filter(condition =>
    context.query?.targetHasCondition(
      condition,
      at,
      context,
    )).length;
}

function applyPanicStrike(context, event, details) {
  if (
    event.actorType !== "player"
    || !(Number(event.coefficient) > 0)
    || !hasThiefTrait(context.config, TRAIT.PANIC_STRIKE)
    || targetConditionCount(context, event.at) < 3
  ) return;
  const state = context.profession;
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

function applyThiefDamageReactions(context, event, details) {
  applySpiderVenom(context, event, details);
  applyShadowSiphoning(context, event);
  applyPanicStrike(context, event, details);
}

function applyThiefConditionReactions(context, application) {
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
