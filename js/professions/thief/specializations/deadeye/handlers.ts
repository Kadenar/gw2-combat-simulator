import { deadeyeState } from "./state.js";
import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";
import { completeStealWithStoredSkill } from "../../core/steal.js";
import { emitStealTraitEffects } from "../../core/traits.js";
import { emitThiefCondition, gainThiefInitiative } from "../../core/shared.js";
import {
  beginStealthAttack,
  completeStealthAttack,
} from "../../core/stealth.js";
import { DEADEYE_STOLEN_ID_BY_CHOICE } from "./mechanics.js";
import { initialDeadeyeMalice } from "./traits.js";
import type { SkillId } from "../../../../platform/engine/types.js";
import type {
  ThiefCastContext,
  ThiefSimulationEvent,
  ThiefSkill,
} from "../../types.js";

interface DeadeyeHandlerState {
  readonly malice?: number;
}

function selectedDeadeyeStolenSkill(context: ThiefCastContext): SkillId {
  const choice =
    context.config.deterministicChoices?.deadeyeStolenSkillChoice ||
    "steal-time";
  return (
    DEADEYE_STOLEN_ID_BY_CHOICE[choice] ||
    DEADEYE_STOLEN_ID_BY_CHOICE["steal-time"]
  );
}

function completeDeadeyesMark(context: ThiefCastContext): void {
  const state = deadeyeState.from(context);
  state.markedTargetId = "primary-target";
  state.malice = initialDeadeyeMalice(context);
  state.maleficentSevenTriggered = false;
  completeStealWithStoredSkill(context, selectedDeadeyeStolenSkill(context));
}

function prepareDeadeyeSpearStealthAttack(
  context: ThiefCastContext,
  skill: ThiefSkill,
): DeadeyeHandlerState {
  const handlerState = {
    malice: Math.max(0, Number(deadeyeState.from(context).malice || 0)),
  };
  beginStealthAttack(context, skill);
  return handlerState;
}

function observeDeadeyeSpearStealthEffect(
  context: ThiefCastContext,
  _skill: ThiefSkill,
  event: ThiefSimulationEvent,
  handlerState: unknown,
): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  if (
    event.type === "damage" &&
    event.name === "Malicious Ashen Assault — Final Strike"
  ) {
    context.replaceEvent(event, {
      coefficient:
        Number(event.coefficient || 0) *
        (1 + Number(prepared.malice || 0) * 0.02),
    });
  }
}

function completeDeadeyeSpearStealthAttack(
  context: ThiefCastContext,
  skill: ThiefSkill,
  handlerState: unknown,
): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  const at = context.effectiveEnd;
  gainThiefInitiative(context, 4, at, "ashen-assault-refund");
  if (Number(prepared.malice || 0) > 0) {
    emitThiefCondition(context, {
      at,
      condition: "Torment",
      duration: 0.5 + Number(prepared.malice) * 0.5,
      stacks: 1,
      sourceId: skill.id,
      name: "Malicious Ashen Assault — Torment",
    });
  }
  completeStealthAttack(context, skill);
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
