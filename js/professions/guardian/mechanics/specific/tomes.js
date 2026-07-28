import { isGw2PlayerActorEvent } from "../../../../platform/gw2/event-ownership.js";
import { GUARDIAN_SKILL_IDS } from "../../data/ids.js";
import { selectedGuardianSpecialization } from "../availability.js";
import { emitGuardianEvent } from "../events.js";
import { GUARDIAN_HANDLER_MECHANICS } from "../handler-mechanics.js";

export function validateTomeCast(context, skill) {
  if (skill.tome) {
    return (
      selectedGuardianSpecialization(context) === "Firebrand" &&
      context.state.profession.activeTome === skill.tome
    );
  }
  if (skill.name === "Stow Tome") {
    return Boolean(context.state.profession.activeTome);
  }
}

/**
 * Tome page cost is a regenerating resource, so an insufficient balance is a
 * wait rather than a permanent denial. Once the open tome and specialization
 * match (handled as permanent gating by validateTomeCast), the scheduler can
 * pause until the next page lands instead of discarding the cast.
 */
export function tomePageAvailability(context, skill) {
  const state = context.state.profession;
  if (
    !skill.tome ||
    selectedGuardianSpecialization(context) !== "Firebrand" ||
    state.activeTome !== skill.tome
  )
    return true;
  const pageCost = Math.max(1, Number(skill.pageCost || 1));
  if (state.tomePages >= pageCost) return true;
  // Pages only ever regenerate upward, so waiting for the scheduled page is a
  // terminating condition. A non-finite next page (tome already at maximum)
  // leaves retryAt null so the denial stays final rather than looping forever.
  const retryAt = Number.isFinite(state.nextTomePageAt)
    ? state.nextTomePageAt
    : null;
  return {
    ready: false,
    retryAt,
    code: "guardian.tome-pages",
    reason:
      `${skill.name} is unavailable — requires ${pageCost} tome ` +
      `page${pageCost === 1 ? "" : "s"}.`,
  };
}

function stowTome(context, skill) {
  context.state.profession.activeTome = "";
  emitGuardianEvent(context, skill, "guardian.tome-stowed", {
    activeTome: "",
  });
  return true;
}

function useTomePage(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  const state = context.state.profession;
  const pageCost = Math.max(1, Number(skill.pageCost || 1));
  if (state.tomePages >= state.maximumTomePages) {
    state.nextTomePageAt = context.effectiveEnd + state.tomePageInterval;
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
    activeTome: state.activeTome,
    nextTomePageAt: state.nextTomePageAt,
    ashesCharges: state.ashesCharges,
    ashesNextTriggerAt: state.ashesNextTriggerAt,
  });
  return false;
}

export const guardianTomeSkillHandlers = Object.freeze({
  "guardian.stow-tome": stowTome,
  "guardian.tome-page": useTomePage,
});

function handleTomeStowed(context) {
  context.profession.activeTome = "";
}

function handleTomePageUsed(context, event) {
  context.profession.tomePages = Number(event.pagesRemaining || 0);
  context.profession.activeTome = String(event.activeTome || "");
  context.profession.nextTomePageAt = Number(
    event.nextTomePageAt ?? context.profession.nextTomePageAt,
  );
  context.profession.ashesCharges = Number(
    event.ashesCharges ?? context.profession.ashesCharges,
  );
  context.profession.ashesNextTriggerAt = Number(
    event.ashesNextTriggerAt ?? context.profession.ashesNextTriggerAt,
  );
}

export const guardianTomeEventHandlers = Object.freeze({
  "guardian.tome-stowed": handleTomeStowed,
  "guardian.tome-page-used": handleTomePageUsed,
});

export function advanceTomeState(context, target) {
  const state = context.state.profession;
  while (
    state.tomePages < state.maximumTomePages &&
    state.nextTomePageAt <= target + context.epsilon
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
  { hitContext, applyCondition } = {},
) {
  const burn = GUARDIAN_HANDLER_MECHANICS.ashesBurn;
  if (
    !hitContext ||
    typeof applyCondition !== "function" ||
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient) > 0)
  )
    return;

  const state = context.profession;
  if (
    state.ashesCharges <= 0 ||
    event.at + Number(context.epsilon || 0.0001) < state.ashesNextTriggerAt
  )
    return;

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
