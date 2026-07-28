import { engineerCatalog } from "./catalog.js";

function stateFrom(context = {}) {
  return context.state?.profession || context.professionState || {};
}

function specializationFrom(context = {}) {
  return context.specialization || context.config?.specialization || "Core";
}

function selectedNames(context = {}) {
  const source =
    context.config?.selectedSkills
    || context.build?.selectedSkills
    || [];
  return new Set(Array.isArray(source) ? source : Object.values(source));
}

function selectedKitNames(context) {
  return new Set(
    engineerCatalog.skills
      .filter(skill =>
        skill.kitEquip && selectedNames(context).has(skill.name))
      .map(skill => skill.kitName || skill.name),
  );
}

function professionSkills(context) {
  const specialization = specializationFrom(context);
  const state = stateFrom(context);
  if (specialization === "Holosmith") {
    return engineerCatalog.skills
      .filter(skill =>
        skill.name === "Engage Photon Forge"
        || skill.name.startsWith("Deactivate Photon Forge"))
      .map(skill => skill.id);
  }
  if (specialization === "Mechanist") {
    const mechToggle = engineerCatalog.skills
      .filter(skill =>
        state.mech?.active
          ? skill.name.startsWith("Recall Mech")
          : skill.name === "Crash Down")
      .map(skill => skill.id);
    return [...(state.mech?.commandSkillIds || []), ...mechToggle];
  }
  if (specialization === "Amalgam") {
    const evolve = engineerCatalog.skills
      .filter(skill => skill.name === "Evolve")
      .map(skill => skill.id);
    return [...(state.selectedMorphSkillIds || []), ...evolve];
  }
  const selected = selectedNames(context);
  return engineerCatalog.skills
    .filter(skill =>
      skill.toolbeltParentName
      && selected.has(skill.toolbeltParentName))
    .map(skill => skill.id);
}

function rotationSkillAvailability(skill, context = {}) {
  const state = stateFrom(context);
  if (skill.id === -3) {
    return {
      available: false,
      message: "Engineers cannot swap equipped weapon sets in combat",
    };
  }
  if (skill.kit && state.activeKit !== skill.kit) {
    return { available: false, message: `Equip ${skill.kit} first` };
  }
  if (skill.forgeSkill && !state.photonForgeActive) {
    return { available: false, message: "Enter Photon Forge first" };
  }
  return { available: true, message: "" };
}

export function engineerEventLogRow(event) {
  if (event.type !== "engineer.state") return undefined;
  return {
    at: event.at,
    type: "Engineer",
    name: event.reason || "State",
    detail: `Heat ${Number(event.state?.heat || 0).toFixed(1)}`,
  };
}

export const engineerUi = Object.freeze({
  paletteGroups: context => {
    const groups = [{
      id: "engineer-profession",
      label: "F",
      skillIds: [...new Set(professionSkills(context))],
      color: "#b88a35",
    }];
    for (const kit of selectedKitNames(context)) {
      groups.push({
        id: `engineer-kit-${kit.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: kit.replace(" Kit", "").slice(0, 4),
        skillIds: engineerCatalog.skills
          .filter(skill => skill.kit === kit)
          .sort((left, right) =>
            Number(left.slot?.split("_")[1] || 99)
            - Number(right.slot?.split("_")[1] || 99))
          .map(skill => skill.id),
        color: "#9d762e",
      });
    }
    if (specializationFrom(context) === "Holosmith") {
      groups.push({
        id: "engineer-forge",
        label: "Forge",
        skillIds: engineerCatalog.skills
          .filter(skill => skill.forgeSkill)
          .map(skill => skill.id),
        color: "#e5a72d",
      });
    }
    return groups;
  },
  resourceViews: context => {
    if (specializationFrom(context) !== "Holosmith") return [];
    const state = stateFrom(context);
    const maximum = Number(state.maximumHeat || 100);
    return [{
      id: "heat",
      singular: "heat",
      plural: "heat",
      maximum,
      value: Number(state.heat ?? context.initialHeat ?? 0),
      startMaximum: maximum,
      startValue: Number(context.initialHeat ?? 0),
      canStart: true,
      buildKey: "initialHeat",
      step: 1,
      displayMode: "bar",
      shortLabel: "Heat",
      statusLabel: state.overheated ? "Overheated" : "Current",
    }];
  },
  rotationSkillAvailability,
  isPaletteSkillAvailable(context, skill) {
    return rotationSkillAvailability(skill, context).available;
  },
  paletteSkillUnavailableMessage(context, skill) {
    return rotationSkillAvailability(skill, context).message;
  },
  eventLogRow: engineerEventLogRow,
});

