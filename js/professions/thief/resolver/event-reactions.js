import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasThiefTrait } from "../state.js";

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

function applyMistburnCharge(context, event, details) {
  if (
    event.actorType !== "player"
    || event.coefficient == null
    || event.skillId === ID.MISTBURN_MORTAR
  ) return;
  const state = context.profession;
  if (
    Number(state.mistburnCharges || 0) <= 0
    || Number(state.mistburnExpiresAt || 0) <= event.at
  ) return;
  state.mistburnCharges -= 1;
  details.applyCondition?.(context, {
    type: "condition",
    at: event.at,
    source: "thief",
    sourceId: ID.MISTBURN_MORTAR,
    actorType: "player",
    skillId: ID.MISTBURN_MORTAR,
    skillName: "Mistburn Mortar",
    name: "Mistburn Mortar — Charged Strike",
    condition: "Burning",
    stacks: 1,
    duration: 1,
    triggeredBy: event.skillName,
  });
}

function applyMeticulousSunCrystal(context, event, details) {
  if (
    event.actorType !== "player"
    || event.skillId !== ID.ZEPHYRITE_SUN_CRYSTAL
    || event.coefficient == null
    || !hasThiefTrait(context.config, TRAIT.METICULOUS_CUSTODIAN)
  ) return;
  details.applyCondition?.(context, {
    type: "condition",
    at: event.at,
    source: "thief",
    sourceId: ID.ZEPHYRITE_SUN_CRYSTAL,
    actorType: "player",
    skillId: ID.ZEPHYRITE_SUN_CRYSTAL,
    skillName: "Zephyrite Sun Crystal",
    name: "Zephyrite Sun Crystal - Meticulous Burning",
    condition: "Burning",
    stacks: 1,
    duration: 5,
  });
}

function applyThiefDamageReactions(context, event, details) {
  applyMeticulousSunCrystal(context, event, details);
  applyMistburnCharge(context, event, details);
  applySpiderVenom(context, event, details);
  applyShadowSiphoning(context, event);
}

function applyThiefConditionReactions(context, application) {
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

export const thiefResolverEventReactions = Object.freeze({
  damage: applyThiefDamageReactions,
  condition: applyThiefConditionReactions,
});
