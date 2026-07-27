import { EPSILON } from "../../../platform/engine/clock.js";
import {
  AMBUSH_ATTACKS,
  MECHANIC_SKILLS,
  SHATTERS,
} from "./skill-mechanics.js";
import {
  mesmerAutoattackChainPosition,
} from "./autoattack-chains.js";
import { runtimeFor } from "./runtime.js";

function skillAvailable(skill, config) {
  if (skill.ambush) return config.specialization === "Mirage";
  if (skill.id < 0) {
    return (
      !skill.specialization
      || skill.specialization === config.specialization
    );
  }
  if (skill.environment !== "Terrestrial") return false;
  if (skill.type === "Profession") {
    return (MECHANIC_SKILLS[config.specialization] || []).includes(skill.name);
  }
  if (
    skill.specialization
    && skill.type !== "Weapon"
    && skill.specialization !== config.specialization
  ) return false;
  if (
    skill.specialization
    && skill.type === "Weapon"
    && !config.weaponmasterTraining
    && skill.specialization !== config.specialization
  ) return false;
  return true;
}

export function mesmerAvailability(context, skill) {
  const runtime = runtimeFor(context);
  const { state } = context;
  const at = context.start;
  if (!skillAvailable(skill, context.config)) {
    return {
      ready: false,
      retryAt: null,
      code: "mesmer.build",
      reason: `${skill.name} is unavailable for this build.`,
    };
  }
  if (skill.ambush) {
    const activeAmbush = AMBUSH_ATTACKS[runtime.activePrimaryWeapon()];
    if (
      !activeAmbush
      || activeAmbush.name !== skill.name
      || !state.profession.ambushSource
      || state.profession.ambushUntil <= at + EPSILON
    ) {
      return {
        ready: false,
        retryAt: null,
        code: "mesmer.ambush",
        reason: `${skill.name} has no active Mirage Cloak ambush window.`,
      };
    }
  }
  const position = mesmerAutoattackChainPosition(skill.id);
  if (position) {
    const expected =
      state.profession.autoattackChains.get(position.root) || position.root;
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
  if (skill.flipParent) {
    const flip = state.profession.availableFlips.get(skill.name);
    if (!flip || flip.expiresAt < at - EPSILON) {
      const parent = runtime.skillsByName.get(skill.flipParent);
      if (parent && context.inFlight.get(parent.id)?.size) {
        return {
          ready: false,
          retryAt: null,
          code: "mesmer.flip-parent-in-flight",
          reason: `${skill.flipParent} is still channeling.`,
        };
      }
      return {
        ready: false,
        retryAt: null,
        code: "mesmer.flip-not-armed",
        reason: `${skill.flipParent} is not active.`,
      };
    }
    if (flip.availableAt > at + EPSILON) {
      return {
        ready: false,
        retryAt: flip.availableAt,
        code: "mesmer.flip-not-ready",
        reason:
          `${skill.name} is not armed until ${flip.availableAt.toFixed(3)}.`,
      };
    }
  }
  if (
    SHATTERS[skill.name]?.kind.startsWith("blade")
    && runtime.actions.currentResource() < 1
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
