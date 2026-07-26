import { guardianCatalog } from "./catalog.js";
import {
  GUARDIAN_VIRTUE_NAMES_BY_SPECIALIZATION,
} from "./mechanics/virtues.js";

function guardianProfessionSkillIds(context = {}) {
  const specialization =
    context.specialization
    || context.config?.specialization
    || "Core";
  const names = [
    ...(GUARDIAN_VIRTUE_NAMES_BY_SPECIALIZATION[specialization] || []),
    ...(specialization === "Firebrand" ? ["Stow Tome"] : []),
    ...(specialization === "Luminary"
      ? ["Enter Radiant Forge"]
      : []),
  ];
  const skillIds = names
    .map(name => guardianCatalog.skillsByName.get(name)?.id)
    .filter(id => id != null);
  const activeFlips = context.state?.profession?.availableFlips
    || context.professionState?.availableFlips
    || {};
  return skillIds.flatMap(id => {
    const skill = guardianCatalog.skillsById.get(id);
    const flipId = skill?.flipSkillId;
    const flip = guardianCatalog.skillsById.get(flipId);
    return (
      flip?.flipParentId === id
      && Number(activeFlips[flipId] || 0) > 0
    ) ? [id, flipId] : [id];
  });
}

function skillsByMode(property, value = true) {
  return guardianCatalog.skills
    .filter(skill => skill[property] === value)
    .sort((left, right) =>
      String(left.slot).localeCompare(String(right.slot))
      || left.name.localeCompare(right.name))
    .map(skill => skill.id);
}

function professionState(context = {}) {
  return context.state?.profession
    || context.professionState
    || {};
}

function guardianPaletteSkillAvailable(context, skill) {
  const state = professionState(context);
  if (
    skill.type === "Weapon"
    && (state.activeTome || state.radiantForge)
  ) return false;
  if (skill.tome) {
    return state.activeTome === skill.tome
      && Number(state.tomePages || 0) >= Number(skill.pageCost || 1);
  }
  if (skill.radiantForgeSkill) return Boolean(state.radiantForge);
  if (skill.name === "Stow Tome") return Boolean(state.activeTome);
  if (skill.name === "Enter Radiant Forge") {
    return !state.radiantForge;
  }
  if (skill.name === "Exit Radiant Forge") {
    return Boolean(state.radiantForge);
  }
  return true;
}

function guardianPaletteSkillUnavailableMessage(context, skill) {
  const state = professionState(context);
  if (skill.type === "Weapon" && state.activeTome) {
    return "Weapon skills are unavailable while a tome is equipped";
  }
  if (skill.type === "Weapon" && state.radiantForge) {
    return "Weapon skills are unavailable during Radiant Forge";
  }
  if (skill.tome && !state.activeTome) {
    return "Equip this tome to use its chapter skills";
  }
  if (skill.tome && state.activeTome !== skill.tome) {
    return `Currently using the ${state.activeTome} tome`;
  }
  if (
    skill.tome
    && Number(state.tomePages || 0) < Number(skill.pageCost || 1)
  ) {
    return `Requires ${Number(skill.pageCost || 1)} tome pages`;
  }
  if (skill.radiantForgeSkill && !state.radiantForge) {
    return "Enter Radiant Forge to use this skill";
  }
  if (skill.name === "Stow Tome") return "No tome is currently equipped";
  if (skill.name === "Enter Radiant Forge") {
    return "Radiant Forge is already active";
  }
  if (skill.name === "Exit Radiant Forge") {
    return "Radiant Forge is not active";
  }
  return "";
}

export const guardianUi = Object.freeze({
  paletteGroups: context => {
    const specialization =
      context.specialization
      || context.config?.specialization
      || "Core";
    const groups = [{
      id: "profession",
      label: "F",
      skillIds: guardianProfessionSkillIds(context),
      color: "#2f7eb8",
    }];
    if (specialization === "Firebrand") {
      groups.push(
        {
          id: "tome-justice",
          label: "F1",
          skillIds: skillsByMode("tome", "justice"),
          color: "#d26b46",
        },
        {
          id: "tome-resolve",
          label: "F2",
          skillIds: skillsByMode("tome", "resolve"),
          color: "#5dad7d",
        },
        {
          id: "tome-courage",
          label: "F3",
          skillIds: skillsByMode("tome", "courage"),
          color: "#6d96ce",
        },
      );
    }
    if (specialization === "Luminary") {
      groups.push({
        id: "radiant-forge",
        label: "RF",
        skillIds: skillsByMode("radiantForgeSkill"),
        color: "#d6b85c",
      });
    }
    return groups;
  },
  isPaletteSkillAvailable: guardianPaletteSkillAvailable,
  paletteSkillUnavailableMessage: guardianPaletteSkillUnavailableMessage,
  resourceViews: context => {
    const specialization =
      context.specialization
      || context.config?.specialization
      || "Core";
    if (specialization !== "Firebrand") return [];
    const state =
      context.state?.profession
      || context.professionState
      || {};
    const maximum = Number(state.maximumTomePages || 5);
    return [{
      id: "pages",
      singular: "page",
      plural: "pages",
      maximum,
      value: Number(state.tomePages ?? maximum),
      canStart: false,
      shortLabel: "Pgs",
      statusLabel: "Current",
    }];
  },
});
