import { professionSpecializationState } from "../../../../platform/engine/profession.js";
import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  emitStealTraitEffects,
  completeStealWithStoredSkill,
} from "../../core/steal.js";
import { hasThiefTrait } from "../../core/state.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefInitiative,
} from "../../core/shared.js";
import {
  beginStealthAttack,
  completeStealthAttack,
} from "../../core/stealth.js";
import { DEADEYE_STOLEN_ID_BY_CHOICE } from "./mechanics.js";

function selectedDeadeyeStolenSkill(context) {
  const choice =
    context.config.deterministicChoices?.deadeyeStolenSkillChoice
    || "steal-time";
  return DEADEYE_STOLEN_ID_BY_CHOICE[choice]
    || DEADEYE_STOLEN_ID_BY_CHOICE["steal-time"];
}

function completeDeadeyesMark(context) {
  const state = professionSpecializationState(context, "Deadeye");
  state.markedTargetId = "primary-target";
  state.malice = hasThiefTrait(
    context.config,
    TRAIT.MALICIOUS_INTENT,
  ) ? 1 : 0;
  state.maleficentSevenTriggered = false;
  completeStealWithStoredSkill(context, selectedDeadeyeStolenSkill(context));
}

function prepareDeadeyeSpearStealthAttack(context, skill) {
  const handlerState = {
    malice: Math.max(0, Number(professionSpecializationState(context, "Deadeye").malice || 0)),
  };
  beginStealthAttack(context, skill);
  return handlerState;
}

function observeDeadeyeSpearStealthEffect(
  context,
  _skill,
  event,
  handlerState = {},
) {
  if (
    event.type === "damage"
    && event.name === "Malicious Ashen Assault — Final Strike"
  ) {
    context.replaceEvent(event, {
      coefficient:
        Number(event.coefficient || 0)
        * (1 + Number(handlerState.malice || 0) * 0.02),
    });
  }
}

function completeDeadeyeSpearStealthAttack(
  context,
  skill,
  handlerState = {},
) {
  const at = context.effectiveEnd;
  gainThiefInitiative(context, 4, at, "ashen-assault-refund");
  if (Number(handlerState.malice || 0) > 0) {
    emitThiefCondition(context, {
      at,
      condition: "Torment",
      duration: 0.5 + Number(handlerState.malice) * 0.5,
      stacks: 1,
      sourceId: skill.id,
      name: "Malicious Ashen Assault — Torment",
    });
  }
  completeStealthAttack(context, skill);
}

export function updateDeadeyeMalice(context, skill) {
  const state = professionSpecializationState(context, "Deadeye");
  const at = context.effectiveEnd;
  if (
    state.markedTargetId
    && skill.type === "Weapon"
    && Number(skill.initiativeCost || 0) > 0
    && !skill.stealthAttack
  ) {
    state.malice = Math.min(state.maximumMalice, state.malice + 1);
    if (
      state.malice === state.maximumMalice
      && !state.maleficentSevenTriggered
      && hasThiefTrait(context.config, TRAIT.MALEFICENT_SEVEN)
    ) {
      state.maleficentSevenTriggered = true;
      gainThiefInitiative(context, 7, at, "maleficent-seven");
    }
    emitThiefState(context, at, "malice");
  }
  if (skill.malicious) {
    state.malice = 0;
    state.maleficentSevenTriggered = false;
    emitThiefState(context, at, "malice-spent");
  }
}

export const deadeyeSkillHandlers = Object.freeze({
  "thief.deadeyes-mark": augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeDeadeyesMark,
  }),
  "thief.deadeye-spear-stealth-attack": augmentSkillHandler(
    prepareDeadeyeSpearStealthAttack,
    {
      afterEffect: observeDeadeyeSpearStealthEffect,
      afterEffects: completeDeadeyeSpearStealthAttack,
    },
  ),
});

export const deadeyeSchedulerHooks = Object.freeze({
  afterCast: Object.freeze([{
    id: "thief.deadeye-malice",
    order: 30,
    handler: updateDeadeyeMalice,
  }]),
});
