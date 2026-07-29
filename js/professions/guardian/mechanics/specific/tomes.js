/**
 * @fileoverview Implements Firebrand tome cast gating, shared page
 * regeneration and spending, tome state replay, and Ashes of the Just damage
 * reactions.
 */

import { isGw2PlayerActorEvent } from "../../../../platform/gw2/event-ownership.js";
import { GUARDIAN_SKILL_IDS } from "../../data/ids.js";
import { selectedGuardianSpecialization } from "../availability.js";
import { emitGuardianEvent } from "../events.js";
import { GUARDIAN_HANDLER_MECHANICS } from "../handler-mechanics.js";

/**
 * Determines whether a tome page or Stow Tome is compatible with the currently
 * active Firebrand tome. Unrelated skills return no opinion.
 *
 * @param {object} context Cast-validation context.
 * @param {object} skill Candidate skill.
 * @returns {boolean|undefined} Whether the relevant tome skill is castable.
 */
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
 *
 * @param {object} context Cast-availability context.
 * @param {object} skill Candidate tome skill.
 * @returns {boolean|object} True when ready, or a retry descriptor when pages
 * are insufficient.
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

/**
 * Closes the active tome and emits the state transition consumed by the
 * resolver.
 *
 * @param {object} context Skill-handler context.
 * @param {object} skill Stow Tome skill.
 * @returns {boolean} Always true to indicate the state-only action completed.
 */
function stowTome(context, skill) {
  context.state.profession.activeTome = "";
  emitGuardianEvent(context, skill, "guardian.tome-stowed", {
    activeTome: "",
  });
  return true;
}

/**
 * Pays a completed tome skill's page cost, arms Ashes when appropriate, closes
 * an exhausted tome, and emits the resulting resource snapshot.
 *
 * @param {object} context Skill-handler context.
 * @param {object} skill Tome page skill.
 * @returns {boolean} True when interrupted; false after a completed page use.
 */
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

/**
 * Raw Firebrand tome callbacks consumed by the central handler registry.
 */
export const guardianTomeSkillHandlers = Object.freeze({
  "guardian.stow-tome": stowTome,
  "guardian.tome-page": useTomePage,
});

/**
 * Replays a tome-stowed event into resolver state.
 *
 * @param {object} context Resolver event-handler context.
 * @returns {void}
 */
function handleTomeStowed(context) {
  context.profession.activeTome = "";
}

/**
 * Replays a tome page resource snapshot into resolver state.
 *
 * @param {object} context Resolver event-handler context.
 * @param {object} event Tome-page-used timeline event.
 * @returns {void}
 */
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

/**
 * Resolver handlers for Firebrand tome timeline events.
 */
export const guardianTomeEventHandlers = Object.freeze({
  "guardian.tome-stowed": handleTomeStowed,
  "guardian.tome-page-used": handleTomePageUsed,
});

/**
 * Regenerates all tome pages due by the target scheduler time and disables the
 * next-page timer when the resource reaches its maximum.
 *
 * @param {object} context Scheduler advancement context.
 * @param {number} target Target simulation time.
 * @returns {void}
 */
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

/**
 * Consumes an available Ashes of the Just charge on an eligible player strike
 * and applies its burning packet subject to the trigger interval.
 *
 * @param {object} context Resolver reaction context.
 * @param {object} event Resolved damage event.
 * @param {object} dependencies Resolver helpers.
 * @param {object} dependencies.hitContext Hit metadata proving this is an
 * eligible resolved strike.
 * @param {Function} dependencies.applyCondition Condition application helper.
 * @returns {void}
 */
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
