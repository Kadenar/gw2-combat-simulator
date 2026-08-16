import { professionCoreState } from "../../../platform/engine/profession.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from "../data/ids.js";
import type { AvailabilityResult } from "../../../platform/engine/types.js";
import type {
  GuardianAvailabilityContext,
  GuardianPrecastContext,
  GuardianSkill,
} from "../types.js";

const READY: Readonly<AvailabilityResult> = Object.freeze({ ready: true });

function deny(
  skill: GuardianSkill,
  code: string,
  cause: string,
): Readonly<AvailabilityResult> {
  return Object.freeze({
    ready: false,
    retryAt: null,
    code,
    reason: `${skill.name} is unavailable — ${cause}`,
  });
}

export function selectedGuardianSpecialization(
  context: GuardianAvailabilityContext = {},
): string {
  const config = context.config || context;
  if (typeof config.specialization === "string") {
    return config.specialization;
  }
  return (
    (config.specializations || [])
      .map((value) => (typeof value === "string" ? value : value?.name))
      .find((name) =>
        context.catalog?.specializations?.some(
          (specialization) =>
            specialization.elite && specialization.name === name,
        ),
      ) || ""
  );
}

/**
 * Permanent build gating. These decisions cannot change while a rotation is
 * running, so they remain boolean validation rather than waitable state.
 */
export function validateGuardianBuild(
  context: GuardianAvailabilityContext,
  skill: GuardianSkill,
): boolean {
  if (!skill.implemented) return false;
  const specialization = selectedGuardianSpecialization(context) || "Core";
  if (
    skill.type !== "Weapon" &&
    skill.specialization &&
    specialization !== skill.specialization
  ) {
    return false;
  }
  if (skill.id === GUARDIAN_SKILL_IDS.MIGHTY_BLOW) {
    return !hasTrait(context, GUARDIAN_TRAIT_IDS.GLACIAL_HEART);
  }
  if (skill.id === GUARDIAN_SKILL_IDS.GLACIAL_BLOW) {
    return hasTrait(context, GUARDIAN_TRAIT_IDS.GLACIAL_HEART);
  }
  return true;
}

/**
 * Runtime Guardian state gates. Generic cooldown and ammo readiness remains
 * scheduler-owned; Firebrand contributes its regenerating tome-page gate from
 * the specialization module.
 */
export function guardianCastAvailability(
  context: GuardianPrecastContext,
  skill: GuardianSkill,
): Readonly<AvailabilityResult> {
  const state = professionCoreState(context);
  if (
    skill.id === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME &&
    Number(state.availableFlips[GUARDIAN_SKILL_IDS.ZEALOTS_FIRE] || 0) >
      context.start + context.epsilon
  ) {
    return deny(
      skill,
      "guardian.flip-parent-active",
      "use the active flip skill first.",
    );
  }
  if (skill.flipParentId != null) {
    // Firebrand mantra flips use persistent ammo/final-charge state and are
    // validated by their specialization instead of a short flip window.
    if (skill.tags?.includes("firebrand-mantra-charge")) return READY;
    return Number(state.availableFlips[skill.id] || 0) >
      context.start + context.epsilon
      ? READY
      : deny(skill, "guardian.flip-not-armed", "not currently armed.");
  }
  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (!chain) return READY;
  const expected = state.autoattackChains[chain.root] || chain.root;
  if (expected === skill.id) return READY;
  const expectedSkill = context.catalog.skillsById.get(expected);
  return deny(
    skill,
    "guardian.autoattack-chain",
    `cast ${expectedSkill?.name || "the earlier chain skill"} first.`,
  );
}
