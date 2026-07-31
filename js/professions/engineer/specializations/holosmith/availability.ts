import {
  professionCoreState,
  professionSpecializationState,
} from "../../../../platform/engine/profession.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasEngineerTrait } from "../../core/state.js";
import {
  denyEngineerCast,
  expectedEngineerChainSkill,
} from "../../core/availability.js";
import type {
  AvailabilityResult,
} from "../../../../platform/engine/types.js";
import type {
  EngineerPrecastContext,
  EngineerSkill,
} from "../../types.js";

export function holosmithCastAvailability(
  context: EngineerPrecastContext,
  skill: EngineerSkill,
): AvailabilityResult {
  if (context.config.specialization !== "Holosmith") return { ready: true };
  const state = professionSpecializationState(context, "Holosmith");
  if (skill.forgeSkill && skill.slot === "Weapon_1") {
    const stormSelected = hasEngineerTrait(
      context.config,
      TRAIT.CRYSTAL_CONFIGURATION_STORM,
    );
    const stormSkill = skill.name.endsWith("—Storm");
    if (stormSelected !== stormSkill) {
      return denyEngineerCast(
        skill,
        "engineer.forge-auto-replaced",
        stormSelected
          ? "Crystal Configuration: Storm replaces this attack."
          : "requires Crystal Configuration: Storm.",
      );
    }
  }
  if (skill.forgeSkill) {
    const queuedChainAfterOverheat =
      skill.slot === "Weapon_1"
      && state.overheated
      && Math.abs(
        context.start - Number(state.forgeExitedAt || 0),
      ) <= Number(context.epsilon || 0.0001)
      && expectedEngineerChainSkill(
        context,
        skill,
        professionCoreState(context),
      );
    if (!state.photonForgeActive && !queuedChainAfterOverheat) {
      return denyEngineerCast(
        skill,
        "engineer.forge-inactive",
        "enter Photon Forge first.",
      );
    }
  } else if (
    skill.type === "Weapon"
    && state.photonForgeActive
  ) {
    return denyEngineerCast(
      skill,
      "engineer.weapon-bar-replaced",
      "Photon Forge replaces weapon skills.",
    );
  }
  if (skill.name === "Engage Photon Forge") {
    if (state.photonForgeActive) {
      return denyEngineerCast(
        skill,
        "engineer.forge-active",
        "Photon Forge is already active.",
      );
    }
    if (state.overheated || state.heat >= state.maximumHeat) {
      return denyEngineerCast(
        skill,
        "engineer.overheated",
        "Photon Forge remains disabled until heat reaches zero.",
      );
    }
  }
  if (
    skill.name.startsWith("Deactivate Photon Forge")
    && !state.photonForgeActive
  ) {
    return denyEngineerCast(
      skill,
      "engineer.forge-inactive",
      "Photon Forge is not active.",
    );
  }
  if (
    skill.handlerId === "engineer.kit-equip"
    && context.start < Number(state.kitLockoutUntil || 0)
  ) {
    return denyEngineerCast(
      skill,
      "engineer.kit-lockout",
      "kits are disabled briefly after entering Photon Forge.",
      state.kitLockoutUntil,
    );
  }
  return { ready: true };
}
