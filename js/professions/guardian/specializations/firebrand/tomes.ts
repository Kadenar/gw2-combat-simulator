import { firebrandState } from "./state.js";
import {
  professionCoreState,
} from "../../../../platform/engine/profession.js";
/**
 * @fileoverview Implements Firebrand tome cast gating, shared page
 * regeneration and spending, tome state replay, and Ashes of the Just damage
 * reactions.
 */

import { isGw2PlayerActorEvent } from "../../../../platform/gw2/event-ownership.js";
import {
  gw2AlliedPlayerAssumptions,
  gw2AlliedPlayerProcTimeline,
} from "../../../../platform/gw2/allied-players.js";
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from "../../data/ids.js";
import { selectedGuardianSpecialization } from "../../core/availability.js";
import { emitGuardianEvent } from "../../core/events.js";
import { FIREBRAND_MECHANICS } from "./mechanics.js";
import { hasGuardianTrait } from "../../core/traits.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type { Gw2ConditionResolution } from "../../../../platform/gw2/types.js";
import type {
  GuardianCastContext,
  GuardianPrecastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
} from "../../types.js";

interface AshesHitDependencies {
  readonly hitContext?: object;
  readonly applyCondition?: Gw2ConditionResolution["applyCondition"];
}

const ASHES_DURATION = 10;

/**
 * Determines whether a tome page or Stow Tome is compatible with the currently
 * active Firebrand tome. Unrelated skills return no opinion.
 *
 * @param {GuardianPrecastContext} context Cast-validation context.
 * @param {GuardianSkill} skill Candidate skill.
 * @returns {boolean|undefined} Whether the relevant tome skill is castable.
 */
export function validateTomeCast(
  context: GuardianPrecastContext,
  skill: GuardianSkill,
): boolean | undefined {
  if (skill.type === "Weapon" && firebrandState.from(context).activeTome) {
    return false;
  }
  if (skill.tome) {
    return (
      selectedGuardianSpecialization(context) === "Firebrand" &&
      firebrandState.from(context).activeTome === skill.tome
    );
  }
  if (skill.name === "Stow Tome") {
    return Boolean(firebrandState.from(context).activeTome);
  }
}

/**
 * Tome page cost is a regenerating resource, so an insufficient balance is a
 * wait rather than a permanent denial. Once the open tome and specialization
 * match (handled as permanent gating by validateTomeCast), the scheduler can
 * pause until the next page lands instead of discarding the cast.
 *
 * @param {GuardianPrecastContext} context Cast-availability context.
 * @param {GuardianSkill} skill Candidate tome skill.
 * @returns {boolean | AvailabilityResult} True when ready, or a retry
 * descriptor when pages are insufficient.
 */
export function tomePageAvailability(
  context: GuardianPrecastContext,
  skill: GuardianSkill,
): boolean | AvailabilityResult {
  const state = firebrandState.from(context);
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
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Stow Tome skill.
 * @returns {boolean} Always true to indicate the state-only action completed.
 */
function stowTome(context: GuardianCastContext, skill: GuardianSkill): boolean {
  firebrandState.from(context).activeTome = "";
  firebrandState.from(context).swiftScholarTome = "";
  firebrandState.from(context).swiftScholarCount = 0;
  emitGuardianEvent(context, skill, "guardian.tome-stowed", {
    activeTome: "",
  });
  return true;
}

/**
 * Pays a completed tome skill's page cost, arms Ashes when appropriate, closes
 * an exhausted tome, and emits the resulting resource snapshot.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Tome page skill.
 * @returns {boolean} True when interrupted; false after a completed page use.
 */
function useTomePage(
  context: GuardianCastContext,
  skill: GuardianSkill,
): boolean {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  const state = firebrandState.from(context);
  const pageCost = Math.max(1, Number(skill.pageCost || 1));
  if (state.tomePages >= state.maximumTomePages) {
    state.nextTomePageAt = context.effectiveEnd + state.tomePageInterval;
  }
  state.tomePages = Math.max(0, state.tomePages - pageCost);
  if (state.swiftScholarTome !== skill.tome) {
    state.swiftScholarTome = String(skill.tome || "");
    state.swiftScholarCount = 0;
  }
  state.swiftScholarCount += 1;
  if (state.swiftScholarCount >= 3) {
    state.swiftScholarCount = 0;
    state.tomePages = Math.min(
      state.maximumTomePages,
      state.tomePages + 1,
    );
    if (state.tomePages >= state.maximumTomePages) {
      state.nextTomePageAt = Number.POSITIVE_INFINITY;
    }
    context.emit({
      type: "proc",
      procType: "trait",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: GUARDIAN_TRAIT_IDS.SWIFT_SCHOLAR,
      actorType: "effect",
      name: "Swift Scholar",
      sourceSkill: skill.name,
      detail: "+1 tome page",
    });
  }
  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.LEGENDARY_LORE)) {
    const boon =
      skill.tome === "justice"
        ? { kind: "might", stacks: 2, duration: 10 }
        : skill.tome === "resolve"
          ? { kind: "regeneration", stacks: 1, duration: 6 }
          : skill.tome === "courage"
            ? { kind: "protection", stacks: 1, duration: 4 }
            : null;
    if (boon) {
      context.emit({
        type: "buff",
        at: context.effectiveEnd,
        source: "guardian",
        sourceId: GUARDIAN_TRAIT_IDS.LEGENDARY_LORE,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        name: "Legendary Lore",
        ...boon,
      });
    }
  }
  if (skill.id === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST) {
    const at = context.effectiveEnd;
    const party = gw2AlliedPlayerAssumptions(context.config);
    state.ashesCharges = 2;
    state.ashesNextTriggerAt = at;
    state.ashesExpiresAt = at + ASHES_DURATION;
    context.emit({
      type: "buff",
      at,
      source: "guardian",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Ashes of the Just",
      kind: "ashes-of-the-just",
      stacks: 2,
      duration: ASHES_DURATION,
      recipients: "party",
      recipientCount: party.count + 1,
    });
    context.emit({
      type: "buff",
      at,
      source: "guardian",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Might",
      kind: "might",
      stacks: 8,
      duration: 10,
      recipients: "party",
      recipientCount: party.count + 1,
    });
    const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
      start: at,
      duration: ASHES_DURATION,
      maximumPerAlly: 2,
      internalCooldown: 1,
    });
    for (let index = 0; index < alliedProcs.length; index += 1) {
      const proc = alliedProcs[index];
      context.emit({
        type: "condition",
        at: proc.at,
        source: "guardian",
        sourceId: "guardian.ashes-of-the-just",
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        name: `Ashes of the Just — Ally ${proc.allyIndex} Burning`,
        condition: "Burning",
        stacks: 1,
        duration: FIREBRAND_MECHANICS.ashesBurn.duration,
        activationId:
          `${context.reservationId}:ally:${proc.allyIndex}:${proc.procIndex}`,
        triggeredByAlly: proc.allyIndex,
        extendsResolutionHorizon: index === alliedProcs.length - 1,
      });
    }
    context.emit({
      type: "guardian.ashes-expired",
      at: state.ashesExpiresAt,
      source: "guardian",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      ashesExpiresAt: state.ashesExpiresAt,
    });
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
    ashesExpiresAt: state.ashesExpiresAt,
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
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @returns {void}
 */
function handleTomeStowed(context: GuardianResolverContext): void {
  firebrandState.from(context).activeTome = "";
}

/**
 * Replays a tome page resource snapshot into resolver state.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Tome-page-used timeline event.
 * @returns {void}
 */
function handleTomePageUsed(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  firebrandState.from(context).tomePages = Number(event.pagesRemaining || 0);
  firebrandState.from(context).activeTome = String(event.activeTome || "");
  firebrandState.from(context).nextTomePageAt = Number(
    event.nextTomePageAt ?? firebrandState.from(context).nextTomePageAt,
  );
  firebrandState.from(context).ashesCharges = Number(
    event.ashesCharges ?? firebrandState.from(context).ashesCharges,
  );
  firebrandState.from(context).ashesNextTriggerAt = Number(
    event.ashesNextTriggerAt ?? firebrandState.from(context).ashesNextTriggerAt,
  );
  firebrandState.from(context).ashesExpiresAt = Number(
    event.ashesExpiresAt ?? firebrandState.from(context).ashesExpiresAt,
  );
}

function handleAshesExpired(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  if (
    Number(firebrandState.from(context).ashesExpiresAt || 0)
    <= Number(event.at) + Number(context.epsilon || 0.0001)
  ) {
    firebrandState.from(context).ashesCharges = 0;
  }
}

/**
 * Resolver handlers for Firebrand tome timeline events.
 */
export const guardianTomeEventHandlers = Object.freeze({
  "guardian.tome-stowed": handleTomeStowed,
  "guardian.tome-page-used": handleTomePageUsed,
  "guardian.ashes-expired": handleAshesExpired,
});

/**
 * Regenerates all tome pages due by the target scheduler time and disables the
 * next-page timer when the resource reaches its maximum.
 *
 * @param {GuardianSchedulerContext} context Scheduler advancement context.
 * @param {number} target Target simulation time.
 * @returns {void}
 */
export function advanceTomeState(
  context: GuardianSchedulerContext,
  target: number,
): void {
  const state = firebrandState.from(context);
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
  if (
    state.ashesCharges > 0 &&
    state.ashesExpiresAt <= target + context.epsilon
  ) {
    state.ashesCharges = 0;
  }
  if (
    selectedGuardianSpecialization({ config: context.config }) !== "Firebrand"
  ) return;
  const courage = context.catalog.skillsById.get(
    GUARDIAN_SKILL_IDS.TOME_OF_COURAGE,
  );
  while (
    courage &&
    state.nextCourageAegisAt <= target + context.epsilon
  ) {
    const at = state.nextCourageAegisAt;
    if (
      at >= Number(
        professionCoreState(context).virtueReadyAt.courage || 0
      ) - context.epsilon ||
      hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR)
    ) {
      context.emit({
        type: "buff",
        at,
        source: "guardian",
        sourceId: courage.id,
        actorType: "player",
        skillId: courage.id,
        skillName: courage.name,
        name: "Tome of Courage — Passive Aegis",
        kind: "aegis",
        stacks: 1,
        duration: 40,
      });
    }
    state.nextCourageAegisAt += 40;
  }
}

/**
 * Consumes an available Ashes of the Just charge on an eligible player strike
 * and applies its burning packet subject to the trigger interval.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {GuardianResolverEvent} event Resolved damage event.
 * @param {AshesHitDependencies} dependencies Resolver helpers.
 * @returns {void}
 */
export function reactToAshesHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  { hitContext, applyCondition }: AshesHitDependencies = {},
): void {
  const burn = FIREBRAND_MECHANICS.ashesBurn;
  if (
    !hitContext ||
    typeof applyCondition !== "function" ||
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient) > 0)
  )
    return;

  const state = firebrandState.from(context);
  if (
    state.ashesCharges <= 0 ||
    event.at >= state.ashesExpiresAt - Number(context.epsilon || 0.0001) ||
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
