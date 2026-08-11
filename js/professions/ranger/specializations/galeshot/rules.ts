import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type { RangerPrecastContext, RangerSkill } from "../../types.js";
import { rangerPetByName } from "../../core/state.js";
import { galeshotState } from "./state.js";
import {
  advanceGaleshotArrows,
  completeGaleshotSkill,
  handleGaleshotDisableTask,
  handleGaleshotMissileHitTask,
  handleGaleshotPetHitTask,
  observeGaleshotEvent,
} from "./mechanics.js";

export const galeshotSchedulerHooks = Object.freeze({
  advance: {
    id: "ranger.galeshot-arrows",
    order: 20,
    handler: advanceGaleshotArrows,
  },
  onCastComplete: {
    id: "ranger.galeshot-traits",
    order: 20,
    handler: completeGaleshotSkill,
  },
  onEventScheduled: {
    id: "ranger.galeshot-events",
    order: 20,
    handler: observeGaleshotEvent,
  },
  taskHandlers: Object.freeze({
    "ranger.galeshot-missile-hit": handleGaleshotMissileHitTask,
    "ranger.galeshot-pet-hit": handleGaleshotPetHitTask,
    "ranger.galeshot-disable": handleGaleshotDisableTask,
  }),
});

function deny(
  skill: RangerSkill,
  code: string,
  cause: string,
): AvailabilityResult {
  return {
    ready: false,
    code,
    reason: `${skill.name} is unavailable - ${cause}`,
  };
}

export function galeshotCastAvailability(
  context: RangerPrecastContext,
  skill: RangerSkill,
): AvailabilityResult {
  const state = galeshotState.from(context);
  if (skill.cycloneBowSkill && !state.cycloneBowActive) {
    return deny(
      skill,
      "ranger.cyclone-bow-inactive",
      "summon the Cyclone Bow first.",
    );
  }
  if (skill.id === ID.SUMMON_CYCLONE_BOW && state.cycloneBowActive) {
    return deny(
      skill,
      "ranger.cyclone-bow-active",
      "the Cyclone Bow is already active.",
    );
  }
  if (skill.id === ID.DISMISS_CYCLONE_BOW && !state.cycloneBowActive) {
    return deny(
      skill,
      "ranger.cyclone-bow-inactive",
      "the Cyclone Bow is not active.",
    );
  }
  if (Number(skill.arrowCost || 0) > state.arrows) {
    return deny(skill, "ranger.arrows", `requires ${skill.arrowCost} arrows.`);
  }
  if (skill.id === ID.HAWKEYE && state.windForce < 5) {
    return deny(skill, "ranger.wind-force", "requires 5 Wind Force.");
  }
  if (skill.id === ID.KEEN_SHOT && state.windForce >= 5) {
    return deny(
      skill,
      "ranger.hawkeye-ready",
      "Hawkeye replaces Keen Shot at 5 Wind Force.",
    );
  }
  if (
    skill.id === ID.QUARRYS_PERIL &&
    hasTrait(context, TRAIT.PERILOUS_SKIES)
  ) {
    return deny(skill, "ranger.perilous-skies", "Pelt replaces this skill.");
  }
  if (skill.id === ID.PELT && !hasTrait(context, TRAIT.PERILOUS_SKIES)) {
    return deny(
      skill,
      "ranger.perilous-skies",
      "select Perilous Skies to replace Quarry's Peril.",
    );
  }
  if (
    state.cycloneBowActive &&
    skill.type === "Weapon" &&
    !skill.cycloneBowSkill
  ) {
    return deny(
      skill,
      "ranger.cyclone-bow-weapon-bar",
      "the Cyclone Bow replaces weapon skills.",
    );
  }
  return { ready: true };
}

function galeshotRuntimeState(context: Gw2ModifierContext) {
  const profession = context.runtime?.profession as
    | {
        specialization?: {
          kind?: string;
          state?: { windForce?: number; galeForceUntil?: number };
        };
      }
    | undefined;
  return profession?.specialization?.kind === "Galeshot"
    ? profession.specialization.state
    : undefined;
}

function windForce(context: Gw2ModifierContext): number {
  return Number(galeshotRuntimeState(context)?.windForce || 0);
}

function galeForceAmount(context: Gw2ModifierContext): number {
  const galeForce =
    Number(galeshotRuntimeState(context)?.galeForceUntil || 0) > context.time
      ? 0.25
      : 0;
  // Hawkeye converts the five existing stacks, but Wind Force earned while
  // Gale Force is active remains a separate stacking damage bonus.
  return galeForce + windForce(context) * 0.03;
}

function activePetIsFeathered(context: Gw2ModifierContext): boolean {
  const runtime = context.runtime as
    { profession?: { core?: { activePet?: string } } } | undefined;
  const name = String(
    runtime?.profession?.core?.activePet || context.config?.selectedPet || "",
  );
  return ["avian", "moa", "phoenix", "raptor swiftwing"].includes(
    rangerPetByName(name).family,
  );
}

function eventSkillId(context: Gw2ModifierContext): number {
  return Number(context.event?.skillId ?? context.skillId);
}

export const galeshotModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "ranger.bird-of-prey",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.05,
    when: (context) =>
      context.event?.actorType !== "summon" &&
      hasTrait(context, TRAIT.BIRD_OF_PREY) &&
      Boolean(context.config?.boons?.swiftness),
  },
  {
    id: "ranger.gale-force",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: galeForceAmount,
    when: (context) =>
      context.event?.actorType !== "summon" &&
      hasTrait(context, TRAIT.GALE_FORCE) &&
      galeForceAmount(context) > 0,
  },
  {
    id: "ranger.flock-together",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.25,
    when: (context) =>
      context.event?.actorType === "summon" &&
      context.event?.source === "ranger-pet" &&
      hasTrait(context, TRAIT.FLOCK_TOGETHER) &&
      activePetIsFeathered(context),
  },
  {
    id: "ranger.piercing-gales-vulnerability",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) =>
      1 +
      Number(
        context.query?.vulnerabilityStacksAt(
          context.time,
          context.runtime || undefined,
        ) || 0,
      ) *
        0.02,
    when: (context) => eventSkillId(context) === ID.PIERCING_GALES,
  },
]);

export const galeshotAttributeRules = Object.freeze({
  modifierRules: galeshotModifierRules,
});
export const galeshotCastRules = Object.freeze({
  availability: {
    id: "ranger.galeshot-availability",
    order: 20,
    handler: galeshotCastAvailability,
  },
});
