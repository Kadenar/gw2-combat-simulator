import {
  createProfessionAssumptionControls,
} from "../../app/profession-assumptions.js";
import { engineerCatalog } from "./catalog.js";
import { getActiveTraits } from "./data/traits-data.js";
import { selectedMechCommands } from "./state.js";

/**
 * Engineer adapter for the shared simulator UI.
 *
 * This module describes how Engineer mechanics should be presented; it does
 * not resolve their combat effects. It builds the toolbelt, mech, kit,
 * Photon Forge, and Amalgam skill groups, exposes Heat, filters slot skills,
 * explains contextual skill availability, and formats Engineer state events.
 */

const KIT_ORDER = new Map([
  ["Grenade Kit", 0],
  ["Flamethrower", 1],
  ["Bomb Kit", 2],
  ["Med Kit", 3],
  ["Tool Kit", 4],
  ["Elixir Gun", 5],
  ["Elite Mortar Kit", 6],
]);

const SKILL_SLOT_ORDER = Object.freeze([
  "Heal",
  "Utility1",
  "Utility2",
  "Utility3",
  "Elite",
]);

const AMALGAM_PROTOCOL_ORDER = new Map([
  ["Offensive Protocol: Shred", 0],
  ["Offensive Protocol: Demolish", 1],
  ["Offensive Protocol: Obliterate", 2],
  ["Offensive Protocol: Pierce", 3],
  ["Defensive Protocol: Thorns", 4],
  ["Defensive Protocol: Cleanse", 5],
  ["Defensive Protocol: Protect", 6],
]);

const UNSELECTABLE_SLOT_SKILLS = new Set([
  "Elixir B",
  "Elixir C",
  "Elixir S",
  "Elixir U",
  "Elixir R",
  "Utility Goggles",
  "Rocket Boots",
]);

const ENGINEER_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  {
    key: "inDamagingField",
    label: "In damaging field",
    type: "boolean",
    defaultValue: false,
    specializations: ["Amalgam"],
  },
]);

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

function selectedNamesInSlotOrder(context = {}) {
  const source =
    context.config?.selectedSkills
    || context.build?.selectedSkills
    || [];
  if (Array.isArray(source)) return [...source];
  return SKILL_SLOT_ORDER.map(slot => source[slot]);
}

function selectedKitNames(context) {
  return [
    ...new Set(engineerCatalog.skills
      .filter(skill =>
        skill.handlerId === "engineer.kit-equip"
        && selectedNames(context).has(skill.name))
      .map(skill => skill.kitName || skill.name)),
  ].sort((left, right) =>
    (KIT_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER)
    - (KIT_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
    || left.localeCompare(right));
}

function uniqueIdsBySkillName(skillIds) {
  return [
    ...new Map(skillIds.map(id => {
      const skill = engineerCatalog.skillsById.get(id);
      return [skill?.name || id, id];
    })).values(),
  ];
}

function uniqueSkillsByName(skills) {
  return [...new Map(skills.map(skill => [skill.name, skill])).values()];
}

function hasActiveTrait(context, name) {
  return getActiveTraits(context.build?.specializations || [])
    .some(trait => trait.name === name);
}

function toolbeltSkillId(parentName) {
  if (!parentName) return null;
  return uniqueSkillsByName(engineerCatalog.skills.filter(skill =>
    skill.toolbeltParentName === parentName
    && !String(skill.name || "").startsWith("Detonate")))[0]?.id ?? null;
}

function namedSkillId(name, predicate = () => true) {
  return engineerCatalog.skills.find(skill =>
    skill.name === name && predicate(skill))?.id ?? null;
}

function mechanistCommandSkillIds(context) {
  const activeTraits = getActiveTraits(context.build?.specializations || []);
  if (activeTraits.length) {
    const traitValues = new Set(activeTraits.flatMap(trait => [
      trait.id,
      trait.name,
    ]));
    return selectedMechCommands(traitValues);
  }
  return [...(stateFrom(context).mech?.commandSkillIds || [])];
}

function professionSkillSlots(context) {
  const specialization = specializationFrom(context);
  const state = stateFrom(context);
  const selected = selectedNamesInSlotOrder(context);
  const toolbelt = selected.map(toolbeltSkillId);
  if (specialization === "Holosmith") {
    const forgeName = state.photonForgeActive
      ? "Deactivate Photon Forge"
      : "Engage Photon Forge";
    return [
      ...toolbelt.slice(0, 4),
      namedSkillId(forgeName),
    ];
  }
  if (specialization === "Mechanist") {
    const mechActive = state.mech?.active !== false;
    return [
      ...mechanistCommandSkillIds(context),
      namedSkillId(mechActive ? "Recall Mech" : "Crash Down"),
    ];
  }
  if (specialization === "Amalgam") {
    const morphs =
      context.build?.selectedMorphSkillIds
      || state.selectedMorphSkillIds
      || [];
    return [
      toolbelt[0],
      ...morphs.slice(0, 3).map(Number),
      namedSkillId("Evolve"),
    ];
  }
  if (specialization === "Scrapper") {
    return [
      ...toolbelt.slice(0, 4),
      namedSkillId("Function Gyro"),
    ];
  }
  return toolbelt;
}

function amalgamProtocolOptions(slot) {
  return engineerCatalog.skills
    .filter(skill =>
      skill.specialization === "Amalgam"
      && skill.categories?.includes("Morph")
      && Number(skill.mechanicSlot) === slot)
    .sort((left, right) =>
      (AMALGAM_PROTOCOL_ORDER.get(left.name) ?? Number.MAX_SAFE_INTEGER)
      - (AMALGAM_PROTOCOL_ORDER.get(right.name) ?? Number.MAX_SAFE_INTEGER)
      || left.id - right.id);
}

function engineerSkillBarGroups(context) {
  const specialization = specializationFrom(context);
  const skillIds = professionSkillSlots(context);
  const selected = context.build?.selectedMorphSkillIds || [];
  return skillIds.flatMap((skillId, index) => {
    if (skillId == null) return [];
    const slot = index + 1;
    const protocolOptions =
      specialization === "Amalgam" && [2, 3, 4].includes(slot)
        ? amalgamProtocolOptions(slot)
        : [];
    const selectedId = Number(selected[slot - 2]);
    const currentId = protocolOptions.length
      && protocolOptions.some(skill => skill.id === selectedId)
      ? selectedId
      : Number(skillId);
    return [{
      id: `engineer-skill-bar-f${slot}`,
      label: protocolOptions.length ? `F${slot} Protocol` : `F${slot}`,
      skillIds: [currentId],
      ...(protocolOptions.length ? {
        optionSkillIds: protocolOptions.map(skill => skill.id),
        selectionKey: "selectedMorphSkillIds",
        selectionIndex: slot - 2,
      } : {}),
      color: protocolOptions.length ? "#67aa87" : "#b88a35",
    }];
  });
}

function updateEngineerSkillBarSelection(context, selection) {
  if (
    specializationFrom(context) !== "Amalgam"
    || selection.key !== "selectedMorphSkillIds"
  ) return false;
  const index = Number(selection.index);
  const slot = index + 2;
  const nextSkill = engineerCatalog.skillsById.get(Number(selection.skillId));
  if (
    ![0, 1, 2].includes(index)
    || nextSkill?.specialization !== "Amalgam"
    || !nextSkill.categories?.includes("Morph")
    || Number(nextSkill.mechanicSlot) !== slot
  ) return false;

  const current = Array.isArray(context.build?.selectedMorphSkillIds)
    ? [...context.build.selectedMorphSkillIds].map(Number)
    : [];
  const previousSkill = engineerCatalog.skillsById.get(current[index]);
  const conflictIndex = current.findIndex((skillId, candidateIndex) =>
    candidateIndex !== index
    && engineerCatalog.skillsById.get(skillId)?.name === nextSkill.name);

  if (conflictIndex >= 0 && previousSkill) {
    const conflictSlot = conflictIndex + 2;
    const replacement = amalgamProtocolOptions(conflictSlot)
      .find(skill => skill.name === previousSkill.name);
    if (!replacement) return false;
    current[conflictIndex] = replacement.id;
  }
  current[index] = nextSkill.id;
  context.build.selectedMorphSkillIds = current;
  return true;
}

function professionSkills(context) {
  return professionSkillSlots(context).filter(id => id != null);
}

function rotationSkillAvailability(skill, context = {}) {
  const state = stateFrom(context);
  if (skill.name === "Electric Artillery") {
    const charging = Number(state.electricArtilleryReadyAt || 0) > 0;
    return {
      available: Boolean(state.electricArtilleryAvailable || charging),
      message: state.electricArtilleryAvailable || charging
        ? ""
        : "Lightning Rod has not finished charging",
    };
  }
  if (
    skill.name === "Lightning Rod"
    && (
      state.electricArtilleryAvailable
      || Number(state.electricArtilleryReadyAt || 0) > 0
    )
  ) {
    return {
      available: false,
      message: "Electric Artillery currently replaces this skill",
    };
  }
  if (skill.id === -3) {
    return {
      available: Boolean(state.activeKit),
      message: state.activeKit
        ? ""
        : "Engineers can use weapon swap only to leave an active kit",
    };
  }
  if (skill.kit && state.activeKit !== skill.kit) {
    return { available: false, message: `Equip ${skill.kit} first` };
  }
  if (
    skill.handlerId === "engineer.kit-equip"
    && state.activeKit === (skill.kitName || skill.name)
  ) {
    return {
      available: false,
      message: `Use Stow ${skill.kitName || skill.name} to leave this kit`,
    };
  }
  if (
    skill.type === "Weapon"
    && skill.weapon
    && (state.activeKit || state.photonForgeActive)
  ) {
    return {
      available: false,
      message: state.activeKit
        ? `${state.activeKit} replaces equipped weapon skills`
        : "Photon Forge replaces equipped weapon skills",
    };
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
  assumptionControls: ENGINEER_ASSUMPTION_CONTROLS,
  skillBarGroups: engineerSkillBarGroups,
  updateSkillBarSelection: updateEngineerSkillBarSelection,
  paletteGroups: context => {
    const groups = [{
      id: "engineer-profession",
      label: "F",
      skillIds: uniqueIdsBySkillName(professionSkills(context)),
      color: "#b88a35",
      resourceAnchor: true,
      includeActionSkills: true,
    }];
    for (const kit of selectedKitNames(context)) {
      const kitSkills = uniqueSkillsByName(
        engineerCatalog.skills.filter(skill => skill.kit === kit),
      );
      groups.push({
        id: `engineer-kit-${kit.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: kit.replace(" Kit", "").slice(0, 4),
        skillIds: kitSkills
          .sort((left, right) =>
            Number(left.slot?.split("_")[1] || 99)
            - Number(right.slot?.split("_")[1] || 99))
          .map(skill => skill.id),
        color: "#9d762e",
        stackId: "engineer-kits",
      });
    }
    if (specializationFrom(context) === "Holosmith") {
      const storm = hasActiveTrait(context, "Crystal Configuration: Storm");
      groups.push({
        id: "engineer-forge",
        label: "Forge",
        skillIds: engineerCatalog.skills
          .filter(skill => {
            if (!skill.forgeSkill) return false;
            if (skill.slot !== "Weapon_1") return true;
            return skill.name.endsWith("—Storm") === storm;
          })
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
  isSlotSkillSelectable(_context, skill) {
    return (
      skill.slotSelectable !== false
      && skill.handlerId !== "engineer.kit-stow"
      && skill.flipParentId == null
      && !String(skill.name || "").startsWith("Detonate")
      && !UNSELECTABLE_SLOT_SKILLS.has(skill.name)
    );
  },
  weaponSwapChangesSet: false,
  isPaletteSkillAvailable(context, skill) {
    return rotationSkillAvailability(skill, context).available;
  },
  paletteSkillUnavailableMessage(context, skill) {
    return rotationSkillAvailability(skill, context).message;
  },
  eventLogRow: engineerEventLogRow,
});
