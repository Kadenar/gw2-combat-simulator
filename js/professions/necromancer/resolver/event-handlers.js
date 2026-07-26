import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import {
  handleNecromancerChillEvent,
  handleNecromancerStateEvent,
  handleNecromancerSummonAttack,
} from "../mechanics/handlers.js";

function hasTrait(context, id) {
  if (context.traits?.has(id) || context.traits?.has(String(id))) return true;
  return [
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ].some(value => value === id || String(value) === String(id));
}

function queueTraitDamage(context, event, {
  name,
  traitId,
  flatStrikeBase,
  flatStrikePowerCoeff,
}) {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    name,
    skillName: name,
    coefficient: 0,
    flatStrikeBase,
    flatStrikePowerCoeff,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    skillWeapon: "Unequipped",
    noCrit: true,
    damageKind: "life-steal",
    triggeredBy: event.skillName,
  });
  context.recordProc?.("trait", name, event.at, event.skillName);
}

function applyTraitCondition(details, context, event, {
  name,
  traitId,
  condition,
  stacks = 1,
  duration,
}) {
  const application = {
    type: "condition",
    at: event.at,
    name: `${name} — ${condition}`,
    skillName: name,
    condition,
    stacks,
    duration,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    triggeredBy: event.skillName,
  };
  if (details.applyCondition) {
    details.applyCondition(context, application);
  } else {
    enqueueOrdered(context.queue, application);
  }
  context.recordProc?.("trait", name, event.at, event.skillName);
}

function reactToNecromancerDamage(context, event, details = {}) {
  if (event.actorType === "effect" || !(Number(event.coefficient) > 0)) {
    return;
  }
  const skill = context.helpers.skillsById?.get(event.skillId);
  if (
    hasTrait(context, TRAIT.DHUUMFIRE)
    && skill?.shroudSlot === 1
  ) {
    applyTraitCondition(details, context, event, {
      name: "Dhuumfire",
      traitId: TRAIT.DHUUMFIRE,
      condition: "Burning",
      duration: 3,
    });
  }
  if (hasTrait(context, TRAIT.BARBED_PRECISION)) {
    context.profession.barbedPrecisionProgress +=
      Number(details.hitContext?.critical?.chance || 0) * 0.33;
    while (context.profession.barbedPrecisionProgress >= 1) {
      context.profession.barbedPrecisionProgress -= 1;
      applyTraitCondition(details, context, event, {
        name: "Barbed Precision",
        traitId: TRAIT.BARBED_PRECISION,
        condition: "Bleeding",
        duration: 2,
      });
    }
  }
  if (
    hasTrait(context, TRAIT.VAMPIRIC_PRESENCE)
    && event.at >= Number(context.profession.vampiricPresenceReadyAt || 0)
  ) {
    context.profession.vampiricPresenceReadyAt = event.at + 1;
    queueTraitDamage(context, event, {
      name: "Vampiric Presence",
      traitId: TRAIT.VAMPIRIC_PRESENCE,
      flatStrikeBase: 80,
      flatStrikePowerCoeff: 0.03,
    });
  }
}

function reactToNecromancerCondition(context, event, details = {}) {
  if (
    event.condition === "Torment"
    && hasTrait(context, TRAIT.DEMONIC_LORE)
    && event.at >= Number(context.profession.demonicLoreReadyAt || 0)
  ) {
    context.profession.demonicLoreReadyAt = event.at + 3;
    applyTraitCondition(details, context, event, {
      name: "Demonic Lore",
      traitId: TRAIT.DEMONIC_LORE,
      condition: "Burning",
      duration: 3,
    });
  }
  if (
    event.condition === "Chilled"
    && hasTrait(context, TRAIT.DEATHLY_CHILL)
  ) {
    applyTraitCondition(details, context, event, {
      name: "Deathly Chill",
      traitId: TRAIT.DEATHLY_CHILL,
      condition: "Bleeding",
      stacks: 3,
      duration: 8,
    });
  }
}

function reactToNecromancerBlind(context, event, details = {}) {
  if (!hasTrait(context, TRAIT.CHILLING_DARKNESS)) return;
  applyTraitCondition(details, context, event, {
    name: "Chilling Darkness",
    traitId: TRAIT.CHILLING_DARKNESS,
    condition: "Chilled",
    duration: 2,
  });
}

function reactToNecromancerControl(context, event, details = {}) {
  if (
    event.controlKind === "fear"
    || event.kind === "fear"
  ) {
    context.profession.dreadUntil = Math.max(
      Number(context.profession.dreadUntil || 0),
      event.at + 3,
    );
  }
  if (hasTrait(context, TRAIT.INSIDIOUS_DISRUPTION)) {
    applyTraitCondition(details, context, event, {
      name: "Insidious Disruption",
      traitId: TRAIT.INSIDIOUS_DISRUPTION,
      condition: "Torment",
      duration: 8,
    });
  }
}

/**
 * Necromancer resolver-side handlers: shroud/state and summon-attack timeline
 * events, plus trait reactions that queue extra damage and conditions.
 */
export const necromancerResolverEventHandlers = Object.freeze({
  "necromancer.state": handleNecromancerStateEvent,
  "necromancer.chill": handleNecromancerChillEvent,
  "necromancer.summon-attack": handleNecromancerSummonAttack,
});

export const necromancerResolverEventReactions = Object.freeze({
  damage: reactToNecromancerDamage,
  condition: reactToNecromancerCondition,
  blind: reactToNecromancerBlind,
  control: reactToNecromancerControl,
});
