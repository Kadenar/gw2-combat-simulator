import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasEngineerTrait } from "../state.js";
import { engineerEnduranceReadyAt } from "./specific/resources.js";

function selectedSkillNames(config) {
  const source = config.selectedSkills || [];
  return new Set(Array.isArray(source) ? source : Object.values(source));
}

function deny(skill, code, cause, retryAt = null) {
  return {
    ready: false,
    retryAt,
    code,
    reason: `${skill.name} is unavailable — ${cause}`,
  };
}

function expectedChainSkill(context, skill, state) {
  const chain = context.catalog.autoattackChainPositions.get(skill.id);
  if (!chain) return true;
  return (state.autoattackChains[chain.root] || chain.root) === skill.id;
}

export function engineerCastAvailability(context, skill) {
  const state = context.state.profession;
  const specialization = String(context.config.specialization || "Core");
  if (skill.id === ID.DODGE) {
    return Number(state.endurance || 0) + Number(context.epsilon || 0.0001)
      >= 50
      ? { ready: true }
      : deny(
        skill,
        "engineer.insufficient-endurance",
        "requires 50 endurance.",
        engineerEnduranceReadyAt(context, 50),
      );
  }
  if (Number(state.plasmaticLockoutUntil || 0) > context.start) {
    return deny(
      skill,
      "engineer.plasmatic-aftercast",
      "Plasmatic State is completing its second packet.",
      state.plasmaticLockoutUntil,
    );
  }
  if (
    skill.name === "Electric Artillery"
    && !state.electricArtilleryAvailable
  ) {
    const retryAt = Number(state.electricArtilleryReadyAt || 0);
    return deny(
      skill,
      "engineer.electric-artillery-inactive",
      "Lightning Rod has not finished charging.",
      retryAt > context.start ? retryAt : null,
    );
  }
  if (
    skill.name === "Lightning Rod"
    && (
      state.electricArtilleryAvailable
      || Number(state.electricArtilleryReadyAt || 0) > context.start
    )
  ) {
    return deny(
      skill,
      "engineer.lightning-rod-active",
      "Electric Artillery currently replaces this skill.",
      Number(state.electricArtilleryExpiresAt || 0) > context.start
        ? state.electricArtilleryExpiresAt
        : null,
    );
  }
  if (skill.simulatorExcluded) {
    return deny(
      skill,
      "engineer.contextual-skill",
      "this skill activates automatically from its parent skill.",
    );
  }
  if (skill.id === -3) {
    return state.activeKit
      ? { ready: true }
      : deny(
        skill,
        "engineer.weapon-swap-disabled",
        "engineers can use weapon swap only to leave an active kit.",
      );
  }
  if (
    skill.specialization
    && skill.type !== "Weapon"
    && String(skill.specialization).toLowerCase()
      !== specialization.toLowerCase()
  ) {
    return deny(
      skill,
      "engineer.wrong-specialization",
      `requires ${skill.specialization}.`,
    );
  }
  if (skill.forgeSkill && skill.slot === "Weapon_1") {
    const stormSelected = hasEngineerTrait(
      context.config,
      TRAIT.CRYSTAL_CONFIGURATION_STORM,
    );
    const stormSkill = skill.name.endsWith("—Storm");
    if (stormSelected !== stormSkill) {
      return deny(
        skill,
        "engineer.forge-auto-replaced",
        stormSelected
          ? "Crystal Configuration: Storm replaces this attack."
          : "requires Crystal Configuration: Storm.",
      );
    }
  }
  if (skill.name === "Function Gyro" && specialization !== "Scrapper") {
    return deny(
      skill,
      "engineer.wrong-specialization",
      "requires Scrapper.",
    );
  }
  if (skill.kit) {
    if (state.activeKit !== skill.kit) {
      return deny(
        skill,
        "engineer.inactive-kit",
        `equip ${skill.kit} first.`,
      );
    }
  } else if (skill.forgeSkill) {
    const queuedChainAfterOverheat =
      skill.slot === "Weapon_1"
      && state.overheated
      && Math.abs(
        context.start - Number(state.forgeExitedAt || 0),
      ) <= Number(context.epsilon || 0.0001)
      && expectedChainSkill(context, skill, state);
    if (!state.photonForgeActive && !queuedChainAfterOverheat) {
      return deny(
        skill,
        "engineer.forge-inactive",
        "enter Photon Forge first.",
      );
    }
  } else if (
    skill.type === "Weapon"
    && (state.activeKit || state.photonForgeActive)
  ) {
    return deny(
      skill,
      "engineer.weapon-bar-replaced",
      "the active kit or Photon Forge replaces weapon skills.",
    );
  }
  if (skill.name === "Engage Photon Forge") {
    if (specialization !== "Holosmith") {
      return deny(skill, "engineer.wrong-specialization", "requires Holosmith.");
    }
    if (state.photonForgeActive) {
      return deny(skill, "engineer.forge-active", "Photon Forge is already active.");
    }
    if (state.overheated || state.heat >= state.maximumHeat) {
      return deny(
        skill,
        "engineer.overheated",
        "Photon Forge remains disabled until heat reaches zero.",
      );
    }
  }
  if (skill.name.startsWith("Deactivate Photon Forge")) {
    return state.photonForgeActive
      ? { ready: true }
      : deny(skill, "engineer.forge-inactive", "Photon Forge is not active.");
  }
  if (skill.handlerId === "engineer.kit-equip") {
    if (!selectedSkillNames(context.config).has(skill.kitName || skill.name)) {
      return deny(
        skill,
        "engineer.kit-not-equipped",
        "the kit is not selected in a slot.",
      );
    }
    if (context.start < Number(state.kitLockoutUntil || 0)) {
      return deny(
        skill,
        "engineer.kit-lockout",
        "kits are disabled briefly after entering Photon Forge.",
        state.kitLockoutUntil,
      );
    }
    if (state.activeKit === (skill.kitName || skill.name)) {
      return deny(
        skill,
        "engineer.kit-active",
        `use Stow ${skill.kitName || skill.name} to leave this kit.`,
      );
    }
  }
  if (
    skill.handlerId === "engineer.consume-flip"
    && !state.availableFlips?.[skill.id]
  ) {
    return deny(
      skill,
      "engineer.flip-inactive",
      `use ${skill.flipParentName || "its parent skill"} first.`,
    );
  }
  if (
    skill.toolbeltParentName
    && skill.name !== "Engage Photon Forge"
    && !skill.name.startsWith("Deactivate Photon Forge")
  ) {
    if (specialization === "Mechanist") {
      return deny(
        skill,
        "engineer.toolbelt-replaced",
        "Mechanist mech commands replace tool-belt skills.",
      );
    }
    if (!selectedSkillNames(context.config).has(skill.toolbeltParentName)) {
      return deny(
        skill,
        "engineer.toolbelt-parent",
        `${skill.toolbeltParentName} is not equipped.`,
      );
    }
  }
  if (specialization === "Mechanist" && skill.mechanicSlot) {
    const slot = Number(skill.mechanicSlot);
    if (slot <= 3 && !state.mech.commandSkillIds.includes(skill.id)) {
      return deny(
        skill,
        "engineer.mech-command",
        "a selected Mechanist trait supplies a different command.",
      );
    }
    if (slot <= 3 && !state.mech.active) {
      return deny(skill, "engineer.mech-inactive", "summon the jade mech first.");
    }
    if (skill.name === "Crash Down" && state.mech.active) {
      return deny(skill, "engineer.mech-active", "the jade mech is already active.");
    }
    if (skill.name.startsWith("Recall Mech") && !state.mech.active) {
      return deny(skill, "engineer.mech-inactive", "the jade mech is not active.");
    }
  }
  if (specialization === "Amalgam" && skill.categories?.includes("Morph")) {
    if (!state.selectedMorphSkillIds.includes(skill.id)) {
      return deny(
        skill,
        "engineer.morph-selection",
        "another morph is selected for this profession slot.",
      );
    }
  }
  if (!expectedChainSkill(context, skill, state)) {
    return deny(
      skill,
      "engineer.autoattack-chain",
      "cast the earlier chain skill first.",
    );
  }
  return { ready: true };
}
