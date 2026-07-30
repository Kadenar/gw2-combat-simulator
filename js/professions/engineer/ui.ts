import {
  createProfessionAssumptionControls,
} from "../../app/profession/assumptions.js";
import {
  SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
} from "../../app/simulation/randomness.js";
import {
  defaultWeaponSkillMatchesSet,
} from "../../platform/gw2/weapon-skill-matcher.js";
import { engineerCatalog } from "./catalog.js";
import { ENGINEER_SKILL_IDS as ID } from "./data/ids.js";
import { getActiveTraits } from "./data/traits-data.js";
import { selectedMechCommands } from "./state.js";
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  EngineerResolverEvent,
  EngineerSkill,
  EngineerState,
  EngineerUiContext,
  EngineerUiSelection,
} from "./types.js";

/**
 * Engineer adapter for the shared simulator UI.
 *
 * This module describes how Engineer mechanics should be presented; it does
 * not resolve their combat effects. It builds the toolbelt, mech, kit,
 * Photon Forge, and Amalgam skill groups, exposes Heat, filters slot skills,
 * explains contextual skill availability, and formats Engineer state events.
 */

const KIT_ORDER = new Map<string, number>([
  ["Grenade Kit", 0],
  ["Flamethrower", 1],
  ["Bomb Kit", 2],
  ["Med Kit", 3],
  ["Tool Kit", 4],
  ["Elixir Gun", 5],
  ["Elite Mortar Kit", 6],
]);

const HEAT_STATE_REASONS = new Set<string>([
  "enter-forge",
  "exit-forge",
  "heat",
  "overheat",
  "passive-heat",
  "thermal-release-valve",
]);

const SKILL_SLOT_ORDER: readonly string[] = Object.freeze([
  "Heal",
  "Utility1",
  "Utility2",
  "Utility3",
  "Elite",
]);

const AMALGAM_PROTOCOL_ORDER = new Map<string, number>([
  ["Offensive Protocol: Shred", 0],
  ["Offensive Protocol: Demolish", 1],
  ["Offensive Protocol: Obliterate", 2],
  ["Offensive Protocol: Pierce", 3],
  ["Defensive Protocol: Thorns", 4],
  ["Defensive Protocol: Cleanse", 5],
  ["Defensive Protocol: Protect", 6],
]);

const UNSELECTABLE_SLOT_SKILLS = new Set<string>([
  "Elixir B",
  "Elixir C",
  "Elixir S",
  "Elixir U",
  "Elixir R",
  "Utility Goggles",
  "Rocket Boots",
]);

const HOLOSMITH_SWORD_SKILL_IDS = new Set<SkillId>([
  ID.RADIANT_ARC,
  ID.SUN_RIPPER,
  ID.SUN_EDGE,
  ID.GLEAM_SABER,
  ID.REFRACTION_CUTTER,
]);
const NON_HOLOSMITH_SWORD_SKILL_IDS = new Set<SkillId>([
  ID.RADIANT_ARC_ID_69565,
  ID.SUN_RIPPER_ID_69906,
  ID.SUN_EDGE_ID_70514,
  ID.GLEAM_SABER_ID_70771,
  ID.REFRACTION_CUTTER_ID_71121,
]);

const ENGINEER_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  {
    key: "inDamagingField",
    label: "In damaging field",
    type: "boolean",
    defaultValue: false,
    specializations: ["Amalgam"],
  },
]);

const engineerSkills =
  engineerCatalog.skills as readonly EngineerSkill[];
const engineerSkillsById =
  engineerCatalog.skillsById as ReadonlyMap<SkillId, EngineerSkill>;

function stateFrom(
  context: EngineerUiContext = {},
): Partial<EngineerState> {
  return context.state?.profession || context.professionState || {};
}

function specializationFrom(context: EngineerUiContext = {}): string {
  return context.specialization || context.config?.specialization || "Core";
}

function selectedNames(context: EngineerUiContext = {}): Set<string> {
  const source: readonly string[] | Readonly<Record<string, string>> =
    context.config?.selectedSkills
    || context.build?.selectedSkills
    || [];
  const values = Array.isArray(source)
    ? source
    : Object.values(source as Readonly<Record<string, string>>);
  return new Set(values);
}

function selectedNamesInSlotOrder(
  context: EngineerUiContext = {},
): (string | undefined)[] {
  const source: readonly string[] | Readonly<Record<string, string>> =
    context.config?.selectedSkills
    || context.build?.selectedSkills
    || [];
  if (Array.isArray(source)) return [...source];
  const slots = source as Readonly<Record<string, string>>;
  return SKILL_SLOT_ORDER.map(slot => slots[slot]);
}

function selectedKitNames(context: EngineerUiContext): string[] {
  return [
    ...new Set(engineerSkills
      .filter(skill =>
        skill.handlerId === "engineer.kit-equip"
        && selectedNames(context).has(skill.name))
      .map(skill => skill.kitName || skill.name)),
  ].sort((left, right) =>
    (KIT_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER)
    - (KIT_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
    || left.localeCompare(right));
}

function uniqueIdsBySkillName(skillIds: readonly SkillId[]): SkillId[] {
  return [
    ...new Map(skillIds.map(id => {
      const skill = engineerSkillsById.get(id);
      return [skill?.name || id, id];
    })).values(),
  ];
}

function uniqueSkillsByName(
  skills: readonly EngineerSkill[],
): EngineerSkill[] {
  return [...new Map(skills.map(skill => [skill.name, skill])).values()];
}

function hasActiveTrait(context: EngineerUiContext, name: string): boolean {
  return getActiveTraits(context.build?.specializations || [])
    .some(trait => trait.name === name);
}

export function engineerWeaponSkillMatchesSet(
  skill: EngineerSkill,
  weapons: string[],
  context: EngineerUiContext = {},
): boolean {
  const holosmith = specializationFrom(context) === "Holosmith";
  if (
    (holosmith && NON_HOLOSMITH_SWORD_SKILL_IDS.has(skill?.id))
    || (!holosmith && HOLOSMITH_SWORD_SKILL_IDS.has(skill?.id))
  ) {
    return false;
  }
  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}

function usesToolsTraitline(context: EngineerUiContext): boolean {
  if (
    (context.build?.specializations || [])
      .some(selection => selection?.name === "Tools")
  ) return true;
  const selected = new Set([
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ].map(value => String(value)));
  return engineerCatalog.traits.some(trait =>
    trait.specialization === "Tools"
    && (
      selected.has(String(trait.id))
      || selected.has(trait.name)
    ));
}

function toolbeltSkillId(parentName: string | undefined): SkillId | null {
  if (!parentName) return null;
  return uniqueSkillsByName(engineerSkills.filter(skill =>
    skill.toolbeltParentName === parentName
    && !String(skill.name || "").startsWith("Detonate")))[0]?.id ?? null;
}

function namedSkillId(
  name: string,
  predicate: (skill: EngineerSkill) => boolean = () => true,
): SkillId | null {
  return engineerSkills.find(skill =>
    skill.name === name && predicate(skill))?.id ?? null;
}

function mechanistCommandSkillIds(
  context: EngineerUiContext,
): SkillId[] {
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

function professionSkillSlots(
  context: EngineerUiContext,
): (SkillId | null)[] {
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

function amalgamProtocolOptions(slot: number): EngineerSkill[] {
  return engineerSkills
    .filter(skill =>
      skill.specialization === "Amalgam"
      && skill.categories?.includes("Morph")
      && Number(skill.mechanicSlot) === slot)
    .sort((left, right) =>
      (AMALGAM_PROTOCOL_ORDER.get(left.name) ?? Number.MAX_SAFE_INTEGER)
      - (AMALGAM_PROTOCOL_ORDER.get(right.name) ?? Number.MAX_SAFE_INTEGER)
      || Number(left.id) - Number(right.id));
}

function engineerSkillBarGroups(
  context: EngineerUiContext,
): ProfessionSkillBarGroup[] {
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

function updateEngineerSkillBarSelection(
  context: EngineerUiContext,
  selection: EngineerUiSelection,
): boolean {
  if (
    specializationFrom(context) !== "Amalgam"
    || selection.key !== "selectedMorphSkillIds"
  ) return false;
  const index = Number(selection.index);
  const slot = index + 2;
  const nextSkill = engineerSkillsById.get(Number(selection.skillId));
  if (
    !context.build
    ||
    ![0, 1, 2].includes(index)
    || nextSkill?.specialization !== "Amalgam"
    || !nextSkill.categories?.includes("Morph")
    || Number(nextSkill.mechanicSlot) !== slot
  ) return false;

  const current = Array.isArray(context.build?.selectedMorphSkillIds)
    ? [...context.build.selectedMorphSkillIds].map(Number)
    : [];
  const previousSkill = engineerSkillsById.get(current[index]);
  const conflictIndex = current.findIndex((skillId, candidateIndex) =>
    candidateIndex !== index
    && engineerSkillsById.get(skillId)?.name === nextSkill.name);

  if (conflictIndex >= 0 && previousSkill) {
    const conflictSlot = conflictIndex + 2;
    const replacement = amalgamProtocolOptions(conflictSlot)
      .find(skill => skill.name === previousSkill.name);
    if (!replacement) return false;
    current[conflictIndex] = Number(replacement.id);
  }
  current[index] = Number(nextSkill.id);
  context.build.selectedMorphSkillIds = current;
  return true;
}

function professionSkills(context: EngineerUiContext): SkillId[] {
  return professionSkillSlots(context).filter(id => id != null);
}

function engineerPaletteSkillAvailability(
  context: EngineerUiContext = {},
  skill: EngineerSkill,
): PaletteSkillAvailability {
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

export function engineerEventLogRow(
  context: EngineerUiContext,
  event: EngineerResolverEvent,
): ProfessionEventLogDescriptor | null | undefined {
  if ([
    "engineer.combo-field",
    "engineer.dodge",
    "engineer.mass-momentum-pulse",
    "engineer.lightning-rod-pulse",
    "engineer.conduit-surge",
    "engineer.electric-artillery",
    "engineer.radiant-arc-quickness",
    "engineer.prime-light-beam-field",
    "engineer.laser-disk",
    "engineer.launch-wall",
    "engineer.refraction-cutter-extra-blades",
  ].includes(event?.type)) {
    // These resolver events materialize skill packets. The ordinary action,
    // damage, and condition rows already present their user-visible effects.
    return null;
  }
  if (event?.type !== "engineer.state") return undefined;
  const buildSpecializations = Array.isArray(context?.build?.specializations)
    ? context.build.specializations
    : [];
  const isHolosmith = buildSpecializations.some(specialization =>
    String(specialization?.name || specialization) === "Holosmith")
    || String(context?.build?.specialization || "") === "Holosmith";
  if (
    !isHolosmith
    || !HEAT_STATE_REASONS.has(String(event.reason || ""))
  ) return null;
  return {
    type: event.type,
    description:
      `${event.reason || "State"} - ` +
      `Heat ${Number(event.state?.heat || 0).toFixed(1)}`,
    className: "resource",
    order: 30,
    flags: [],
  };
}

export const engineerUi: Partial<ProfessionUiContract> & SchedulerRecord =
Object.freeze({
  assumptionControls: ENGINEER_ASSUMPTION_CONTROLS,
  weaponSkillMatchesSet: engineerWeaponSkillMatchesSet,
  skillBarGroups: engineerSkillBarGroups,
  updateSkillBarSelection: updateEngineerSkillBarSelection,
  paletteGroups: (context: EngineerUiContext) => {
    const groups: ProfessionPaletteGroup[] = [{
      id: "engineer-profession",
      label: "F",
      skillIds: uniqueIdsBySkillName(professionSkills(context)),
      color: "#b88a35",
      resourceAnchor: true,
      includeActionSkills: true,
    }];
    for (const kit of selectedKitNames(context)) {
      const kitSkills = uniqueSkillsByName(
        engineerSkills.filter(skill => skill.kit === kit),
      );
      groups.push({
        id: `engineer-kit-${kit.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: kit.replace(" Kit", "").slice(0, 4),
        skillIds: kitSkills
          .sort((left, right) =>
            Number(String(left.slot || "").split("_")[1] || 99)
            - Number(String(right.slot || "").split("_")[1] || 99))
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
        skillIds: engineerSkills
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
  timelineWeaponLineTransition: (context: EngineerUiContext) => {
    const skill = context.skill;
    if (skill?.handlerId === "engineer.kit-equip") {
      return skill.kitName || skill.name;
    }
    if (skill?.handlerId === "engineer.photon-forge-enter") {
      return "Photon Forge";
    }
    if (
      skill?.handlerId === "engineer.kit-stow"
      || skill?.handlerId === "engineer.photon-forge-exit"
      || (
        context.weaponLine
        && context.entry?.name === "Swap Weapons"
      )
    ) {
      return null;
    }
    return undefined;
  },
  resourceViews: (context: EngineerUiContext) => {
    const state = stateFrom(context);
    const views: ProfessionResourceView[] = [];
    const endurance: ProfessionResourceView = {
      id: "endurance",
      singular: "endurance",
      plural: "endurance",
      maximum: Number(state.maximumEndurance || 100),
      value: Number(state.endurance ?? 100),
      startMaximum: 100,
      startValue: 100,
      canStart: false,
      displayMode: "bar",
      shortLabel: "End",
      statusLabel: "Current",
    };
    if (usesToolsTraitline(context)) views.push(endurance);
    if (specializationFrom(context) !== "Holosmith") return views;
    const maximum = Number(state.maximumHeat || 100);
    views.push({
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
    });
    return views;
  },
  paletteSkillAvailability: engineerPaletteSkillAvailability,
  isSlotSkillSelectable(
    _context: EngineerUiContext,
    skill: EngineerSkill,
  ): boolean {
    return (
      skill.slotSelectable !== false
      && skill.handlerId !== "engineer.kit-stow"
      && skill.flipParentId == null
      && !String(skill.name || "").startsWith("Detonate")
      && !UNSELECTABLE_SLOT_SKILLS.has(skill.name)
    );
  },
  weaponSwapChangesSet: false,
  eventLogRow: engineerEventLogRow,
});
