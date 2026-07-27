import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import {
  isInternalCooldownReady,
} from "../../../platform/engine/internal-cooldown.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import {
  handleNecromancerChillEvent,
  handleNecromancerStateEvent,
  handleNecromancerSummonAttack,
} from "../mechanics/specific/handlers.js";
import {
  NECROMANCER_HANDLER_MECHANICS as MECHANICS,
} from "../mechanics/skill-mechanics.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";

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
    applyTraitCondition(
      details,
      context,
      event,
      MECHANICS.traitProcs[TRAIT.DHUUMFIRE],
    );
  }
  if (hasTrait(context, TRAIT.BARBED_PRECISION)) {
    context.profession.barbedPrecisionProgress +=
      Number(details.hitContext?.critical?.chance || 0)
      * MECHANICS.traitProcs[TRAIT.BARBED_PRECISION].criticalProgress;
    while (context.profession.barbedPrecisionProgress >= 1) {
      context.profession.barbedPrecisionProgress -= 1;
      applyTraitCondition(
        details,
        context,
        event,
        MECHANICS.traitProcs[TRAIT.BARBED_PRECISION],
      );
    }
  }
  if (
    hasTrait(context, TRAIT.VAMPIRIC_PRESENCE)
    && isInternalCooldownReady(
      event.at,
      Number(context.profession.vampiricPresenceReadyAt || 0),
    )
  ) {
    const proc = MECHANICS.traitProcs[TRAIT.VAMPIRIC_PRESENCE];
    context.profession.vampiricPresenceReadyAt = event.at + proc.interval;
    queueTraitDamage(context, event, proc);
  }
}

function reactToNecromancerCondition(context, event, details = {}) {
  if (
    event.condition === "Torment"
    && hasTrait(context, TRAIT.DEMONIC_LORE)
    && isInternalCooldownReady(
      event.at,
      Number(context.profession.demonicLoreReadyAt || 0),
    )
  ) {
    const proc = MECHANICS.traitProcs[TRAIT.DEMONIC_LORE];
    context.profession.demonicLoreReadyAt = event.at + proc.interval;
    applyTraitCondition(details, context, event, proc);
  }
  if (
    event.condition === "Chilled"
    && hasTrait(context, TRAIT.DEATHLY_CHILL)
  ) {
    applyTraitCondition(
      details,
      context,
      event,
      MECHANICS.traitProcs[TRAIT.DEATHLY_CHILL],
    );
  }
}

function reactToNecromancerBlind(context, event, details = {}) {
  if (!hasTrait(context, TRAIT.CHILLING_DARKNESS)) return;
  applyTraitCondition(
    details,
    context,
    event,
    MECHANICS.traitProcs[TRAIT.CHILLING_DARKNESS],
  );
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
    applyTraitCondition(
      details,
      context,
      event,
      MECHANICS.traitProcs[TRAIT.INSIDIOUS_DISRUPTION],
    );
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
