import { ENGINEER_AUTOATTACK_CHAINS } from "../catalog.js";

const CHAIN_BY_ID = new Map();
for (const chain of ENGINEER_AUTOATTACK_CHAINS) {
  chain.forEach((id, index) => CHAIN_BY_ID.set(id, {
    root: chain[0],
    next: chain[index + 1] ?? null,
  }));
}

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

function expectedChainSkill(skill, state) {
  const chain = CHAIN_BY_ID.get(skill.id);
  if (!chain) return true;
  return (state.autoattackChains[chain.root] || chain.root) === skill.id;
}

export function engineerCastAvailability(context, skill) {
  const state = context.state.profession;
  const specialization = String(context.config.specialization || "Core");
  if (skill.id === -3) {
    return deny(
      skill,
      "engineer.weapon-swap-disabled",
      "engineers cannot swap equipped weapon sets in combat.",
    );
  }
  if (
    skill.specialization
    && skill.type !== "Weapon"
    && skill.specialization !== specialization
  ) {
    return deny(
      skill,
      "engineer.wrong-specialization",
      `requires ${skill.specialization}.`,
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
    if (!state.photonForgeActive) {
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
  if (skill.kitEquip) {
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
  if (!expectedChainSkill(skill, state)) {
    return deny(
      skill,
      "engineer.autoattack-chain",
      "cast the earlier chain skill first.",
    );
  }
  return { ready: true };
}
