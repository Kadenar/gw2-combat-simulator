import { EPSILON } from "../../../platform/engine/clock.js";
import {
  AMBUSH_ATTACKS,
  MECHANIC_SKILLS,
  SHATTERS,
} from "./skill-mechanics.js";
import { MESMER_SKILL_IDS as ID } from "../data/ids.js";
import { mesmerRuntimeFor } from "./handler-mechanics.js";

export function isMesmerBuildSkillAvailable(skill, config) {
  if (skill.ambush) return config.specialization === "Mirage";
  if (skill.id < 0) {
    return (
      !skill.specialization || skill.specialization === config.specialization
    );
  }
  if (skill.environment !== "Terrestrial") return false;
  if (skill.type === "Profession") {
    return (MECHANIC_SKILLS[config.specialization] || []).includes(skill.id);
  }
  if (
    skill.specialization &&
    skill.type !== "Weapon" &&
    skill.specialization !== config.specialization
  )
    return false;
  if (
    skill.specialization &&
    skill.type === "Weapon" &&
    !config.weaponmasterTraining &&
    skill.specialization !== config.specialization
  )
    return false;
  return true;
}

export function mesmerMinimumResource(skill) {
  return SHATTERS[skill.id]?.kind.startsWith("blade") ? 1 : 0;
}

export function isMesmerContinuumSkillAvailable(skill, continuumActive) {
  return skill.id !== ID.CONTINUUM_SHIFT || Boolean(continuumActive);
}

export function mesmerAvailability(context, skill) {
  const runtime = mesmerRuntimeFor(context);
  const { state } = context;
  const at = context.start;
  if (!isMesmerBuildSkillAvailable(skill, context.config)) {
    return {
      ready: false,
      retryAt: null,
      code: "mesmer.build",
      reason: `${skill.name} is unavailable for this build.`,
    };
  }
  if (
    !isMesmerContinuumSkillAvailable(
      skill,
      Boolean(state.profession.continuum),
    )
  ) {
    return {
      ready: false,
      retryAt: null,
      code: "mesmer.continuum-inactive",
      reason: `${skill.name} requires an active Continuum Split.`,
    };
  }
  if (skill.ambush) {
    const activeAmbush = AMBUSH_ATTACKS[runtime.activePrimaryWeapon()];
    if (
      !activeAmbush ||
      activeAmbush.name !== skill.name ||
      !state.profession.ambushSource ||
      state.profession.ambushUntil <= at + EPSILON
    ) {
      return {
        ready: false,
        retryAt: null,
        code: "mesmer.ambush",
        reason: `${skill.name} has no active Mirage Cloak ambush window.`,
      };
    }
  }
  const position = context.catalog.autoattackChainPositions.get(skill.id);
  if (position) {
    const expected =
      state.profession.autoattackChains[position.root] || position.root;
    if (skill.id !== expected) {
      return {
        ready: false,
        retryAt: null,
        code: "mesmer.autoattack-chain",
        reason: `Cannot cast ${skill.name}; cast ${
          runtime.skillsById.get(expected)?.name || expected
        } first.`,
      };
    }
  }
  if (skill.mesmerMechanic?.flipParentId) {
    const flip = state.profession.availableFlips[skill.id];
    if (!flip || flip.expiresAt < at - EPSILON) {
      const parent = runtime.skillsById.get(
        skill.mesmerMechanic?.flipParentId,
      );
      if (parent && context.inFlight.get(parent.id)?.size) {
        return {
          ready: false,
          retryAt: null,
          code: "mesmer.flip-parent-in-flight",
          reason: `${parent.name} is still channeling.`,
        };
      }
      return {
        ready: false,
        retryAt: null,
        code: "mesmer.flip-not-armed",
        reason: `${parent?.name || "The parent skill"} is not active.`,
      };
    }
    if (flip.availableAt > at + EPSILON) {
      return {
        ready: false,
        retryAt: flip.availableAt,
        code: "mesmer.flip-not-ready",
        reason: `${skill.name} is not armed until ${flip.availableAt.toFixed(3)}.`,
      };
    }
  }
  if (
    runtime.actions.currentResource() < mesmerMinimumResource(skill)
  ) {
    return {
      ready: false,
      retryAt: null,
      code: "mesmer.no-blades",
      reason: `${skill.name} requires at least one blade.`,
    };
  }
  return { ready: true };
}
