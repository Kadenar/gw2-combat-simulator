import { isGw2PlayerActorEvent } from "../../../../platform/gw2/event-ownership.js";
import { GUARDIAN_SKILL_IDS } from "../../data/ids.js";
import { selectedGuardianSpecialization } from "../availability.js";
import {
  emitGuardianEvent,
  handleScheduledStateEvent,
} from "../events.js";
import { GUARDIAN_HANDLER_MECHANICS } from "../skill-mechanics.js";

export function validateTomeCast(context, skill) {
  if (skill.tome) {
    return selectedGuardianSpecialization(context) === "Firebrand"
      && context.state.profession.activeTome === skill.tome
      && context.state.profession.tomePages >= Number(skill.pageCost || 1);
  }
  if (skill.name === "Stow Tome") {
    return Boolean(context.state.profession.activeTome);
  }
}

function stowTome(context, skill) {
  context.state.profession.activeTome = "";
  emitGuardianEvent(context, skill, "guardian.tome-stowed");
  return true;
}

function useTomePage(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  const state = context.state.profession;
  const pageCost = Math.max(1, Number(skill.pageCost || 1));
  if (state.tomePages >= state.maximumTomePages) {
    state.nextTomePageAt =
      context.effectiveEnd + state.tomePageInterval;
  }
  state.tomePages = Math.max(0, state.tomePages - pageCost);
  if (skill.id === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST) {
    state.ashesCharges = 2;
    state.ashesNextTriggerAt = context.effectiveEnd;
  }
  if (state.tomePages === 0) state.activeTome = "";
  emitGuardianEvent(context, skill, "guardian.tome-page-used", {
    tome: skill.tome,
    pageCost,
    pagesRemaining: state.tomePages,
  });
  return false;
}

export const guardianTomeSkillHandlers = Object.freeze({
  "guardian.stow-tome": stowTome,
  "guardian.tome-page": useTomePage,
});

export const guardianTomeEventHandlers = Object.freeze({
  "guardian.tome-stowed": handleScheduledStateEvent,
  "guardian.tome-page-used": handleScheduledStateEvent,
});

export function advanceTomeState(context, target) {
  const state = context.state.profession;
  while (
    state.tomePages < state.maximumTomePages
    && state.nextTomePageAt <= target + context.epsilon
  ) {
    state.tomePages += 1;
    state.nextTomePageAt += state.tomePageInterval;
  }
  if (state.tomePages >= state.maximumTomePages) {
    state.nextTomePageAt = Number.POSITIVE_INFINITY;
  }
}

export function reactToAshesHit(
  context,
  event,
  {
    hitContext,
    applyCondition,
  } = {},
) {
  const burn = GUARDIAN_HANDLER_MECHANICS.ashesBurn;
  if (
    !hitContext
    || typeof applyCondition !== "function"
    || !isGw2PlayerActorEvent(event)
    || !(Number(event.coefficient) > 0)
  ) return;

  const state = context.state.profession;
  if (
    state.ashesCharges <= 0
    || event.at + Number(context.epsilon || 0.0001)
      < state.ashesNextTriggerAt
  ) return;

  applyCondition(context, {
    type: "condition",
    at: event.at,
    source: "guardian",
    sourceId: "guardian.ashes-of-the-just",
    actorType: "player",
    skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
    skillName: "Epilogue: Ashes of the Just",
    name: "Ashes of the Just — Burning",
    condition: burn.condition,
    stacks: burn.stacks,
    duration: burn.duration,
  });
  state.ashesCharges -= 1;
  state.ashesNextTriggerAt = event.at + burn.interval;
  context.recordProc(
    "profession",
    "Ashes of the Just",
    event.at,
    event.skillName,
  );
}
