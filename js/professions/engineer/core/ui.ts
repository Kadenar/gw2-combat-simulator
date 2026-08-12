import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from "../../../app/simulation/randomness.js";
import { defaultWeaponSkillMatchesSet } from "../../../platform/gw2/weapon-skill-matcher.js";
import { flattenProfessionState } from "../../../platform/engine/profession.js";
import { ENGINEER_SKILL_IDS as ID } from "../data/ids.js";
import { getActiveTraits } from "../data/traits-data.js";
import type {
  PaletteSkillAvailability,
  CanonicalCatalog,
  CatalogEntity,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  EngineerResolverEvent,
  EngineerSkill,
  EngineerState,
  EngineerUiContext,
} from "../types.js";

/**
 * Core Engineer presentation and shared application callbacks. Elite modules
 * own their profession bars, resources, assumptions, and palette groups.
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

const SKILL_SLOT_ORDER: readonly string[] = Object.freeze([
  "Heal",
  "Utility1",
  "Utility2",
  "Utility3",
  "Elite",
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

const CORE_STATE_REASONS = new Set<string>([
  "arm-flip",
  "consume-flip",
  "equip-kit",
  "stow-kit",
  "dodge",
  "resources",
  "lightning-rod-active",
  "conduit-surge",
  "electric-artillery-consumed",
  "electric-artillery-ready",
  "electric-artillery-expired",
  "kinetic-battery",
  "deploy-turret",
]);

let engineerSkills: readonly EngineerSkill[] = [];
let engineerSkillsById: ReadonlyMap<SkillId, EngineerSkill> = new Map();
let engineerTraits: readonly CatalogEntity[] = [];

export function engineerUiState(
  context: EngineerUiContext = {},
): Partial<EngineerState> {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  );
}

export function engineerUiSpecialization(
  context: EngineerUiContext = {},
): string {
  return String(
    context.specialization ||
      context.config?.specialization ||
      context.build?.specialization ||
      "Core",
  );
}

function selectedNames(context: EngineerUiContext = {}): Set<string> {
  const source: readonly string[] | Readonly<Record<string, string>> =
    context.config?.selectedSkills || context.build?.selectedSkills || [];
  const values = Array.isArray(source)
    ? source
    : Object.values(source as Readonly<Record<string, string>>);
  return new Set(values);
}

export function selectedNamesInSlotOrder(
  context: EngineerUiContext = {},
): (string | undefined)[] {
  const source: readonly string[] | Readonly<Record<string, string>> =
    context.config?.selectedSkills || context.build?.selectedSkills || [];
  if (Array.isArray(source)) return [...source];
  const slots = source as Readonly<Record<string, string>>;
  return SKILL_SLOT_ORDER.map((slot) => slots[slot]);
}

export function selectedKitNames(context: EngineerUiContext): string[] {
  return [
    ...new Set(
      engineerSkills
        .filter(
          (skill) =>
            skill.handlerId === "engineer.kit-equip" &&
            selectedNames(context).has(skill.name),
        )
        .map((skill) => skill.kitName || skill.name),
    ),
  ].sort(
    (left, right) =>
      (KIT_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (KIT_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER) ||
      left.localeCompare(right),
  );
}

export function uniqueIdsBySkillName(skillIds: readonly SkillId[]): SkillId[] {
  return [
    ...new Map(
      skillIds.map((id) => {
        const skill = engineerSkillsById.get(id);
        return [skill?.name || id, id];
      }),
    ).values(),
  ];
}

export function uniqueSkillsByName(
  skills: readonly EngineerSkill[],
): EngineerSkill[] {
  return [...new Map(skills.map((skill) => [skill.name, skill])).values()];
}

export function hasActiveTrait(
  context: EngineerUiContext,
  name: string,
): boolean {
  return getActiveTraits(context.build?.specializations || []).some(
    (trait) => trait.name === name,
  );
}

export function engineerWeaponSkillMatchesSet(
  skill: EngineerSkill,
  weapons: string[],
  context: EngineerUiContext = {},
): boolean {
  const holosmith = engineerUiSpecialization(context) === "Holosmith";
  if (
    (holosmith && NON_HOLOSMITH_SWORD_SKILL_IDS.has(skill?.id)) ||
    (!holosmith && HOLOSMITH_SWORD_SKILL_IDS.has(skill?.id))
  ) {
    return false;
  }
  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}

function usesToolsTraitline(context: EngineerUiContext): boolean {
  if (
    (context.build?.specializations || []).some(
      (selection) => selection?.name === "Tools",
    )
  )
    return true;
  const selected = new Set(
    [
      ...(context.config?.traitIds || []),
      ...(context.config?.selectedTraitIds || []),
      ...(context.config?.selectedTraits || []),
    ].map((value) => String(value)),
  );
  return engineerTraits.some(
    (trait) =>
      trait.specialization === "Tools" &&
      (selected.has(String(trait.id)) || selected.has(trait.name)),
  );
}

export function toolbeltSkillId(
  parentName: string | undefined,
): SkillId | null {
  if (!parentName) return null;
  return (
    uniqueSkillsByName(
      engineerSkills.filter(
        (skill) =>
          skill.toolbeltParentName === parentName &&
          !String(skill.name || "").startsWith("Detonate"),
      ),
    )[0]?.id ?? null
  );
}

export function namedSkillId(
  name: string,
  predicate: (skill: EngineerSkill) => boolean = () => true,
): SkillId | null {
  return (
    engineerSkills.find((skill) => skill.name === name && predicate(skill))
      ?.id ?? null
  );
}

export function engineerToolbeltSkillIds(
  context: EngineerUiContext,
): (SkillId | null)[] {
  return selectedNamesInSlotOrder(context).map(toolbeltSkillId);
}

export function professionSkillSlots(
  context: EngineerUiContext,
): (SkillId | null)[] {
  return engineerToolbeltSkillIds(context);
}

interface EngineerFSkillBarOptions {
  readonly label?: string;
  readonly optionSkillIds?: readonly SkillId[];
  readonly selectionKey?: string;
  readonly selectionIndex?: number;
  readonly color?: string;
}

export function engineerFSkillBarGroups(
  skillIds: readonly (SkillId | null)[],
  optionsBySlot: Readonly<Record<number, EngineerFSkillBarOptions>> = {},
): ProfessionSkillBarGroup[] {
  return skillIds.flatMap((skillId, index) => {
    if (skillId == null) return [];
    const slot = index + 1;
    const options = optionsBySlot[slot] || {};
    return [
      {
        id: `engineer-skill-bar-f${slot}`,
        label: options.label || `F${slot}`,
        skillIds: [skillId],
        ...(options.optionSkillIds?.length
          ? {
              optionSkillIds: [...options.optionSkillIds],
              selectionKey: options.selectionKey,
              selectionIndex: options.selectionIndex,
            }
          : {}),
        color: options.color || "#b88a35",
      },
    ];
  });
}

export function engineerSkillBarGroups(
  context: EngineerUiContext,
): ProfessionSkillBarGroup[] {
  return engineerFSkillBarGroups(engineerToolbeltSkillIds(context));
}

export function professionSkills(context: EngineerUiContext): SkillId[] {
  return professionSkillSlots(context).filter((id) => id != null);
}

export function engineerCorePaletteSkillAvailability(
  context: EngineerUiContext = {},
  skill: EngineerSkill,
): PaletteSkillAvailability {
  const state = engineerUiState(context);
  if (skill.name === "Electric Artillery") {
    return {
      available: Boolean(state.electricArtilleryAvailable),
      message: state.electricArtilleryAvailable
        ? ""
        : "Lightning Rod has not finished charging",
    };
  }
  if (
    skill.name === "Lightning Rod" &&
    (state.electricArtilleryAvailable ||
      Number(state.electricArtilleryReadyAt || 0) > 0)
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
    skill.handlerId === "engineer.kit-equip" &&
    state.activeKit === (skill.kitName || skill.name)
  ) {
    return {
      available: false,
      message: `Use Stow ${skill.kitName || skill.name} to leave this kit`,
    };
  }
  if (
    skill.type === "Weapon" &&
    skill.weapon &&
    (state.activeKit || state.photonForgeActive)
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
  if (
    [
      "engineer.combo-field",
      "engineer.dodge",
      "engineer.lightning-rod-pulse",
      "engineer.conduit-surge",
      "engineer.electric-artillery",
      "engineer.radiant-arc-quickness",
      "engineer.refraction-cutter-extra-blades",
    ].includes(event?.type)
  ) {
    // These resolver events materialize skill packets. The ordinary action,
    // damage, and condition rows already present their user-visible effects.
    return null;
  }
  if (
    event?.type === "engineer.state" &&
    (engineerUiSpecialization(context) === "Core" ||
      CORE_STATE_REASONS.has(String(event.reason)))
  )
    return null;
  return undefined;
}

export const engineerCoreUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
    weaponSkillMatchesSet: engineerWeaponSkillMatchesSet,
    skillBarGroups: (context: EngineerUiContext) =>
      engineerUiSpecialization(context) === "Core"
        ? engineerSkillBarGroups(context)
        : [],
    paletteGroups: (context: EngineerUiContext) => {
      const groups: ProfessionPaletteGroup[] = [];
      for (const kit of selectedKitNames(context)) {
        const kitSkills = uniqueSkillsByName(
          engineerSkills.filter((skill) => skill.kit === kit),
        );
        groups.push({
          id: `engineer-kit-${kit.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          label: kit.replace(" Kit", "").slice(0, 4),
          skillIds: kitSkills
            .sort(
              (left, right) =>
                Number(String(left.slot || "").split("_")[1] || 99) -
                Number(String(right.slot || "").split("_")[1] || 99),
            )
            .map((skill) => skill.id),
          color: "#9d762e",
          stackId: "engineer-kits",
        });
      }
      if (engineerUiSpecialization(context) === "Core") {
        groups.push({
          id: "engineer-profession",
          label: "F",
          skillIds: uniqueIdsBySkillName(professionSkills(context)),
          color: "#b88a35",
          resourceAnchor: true,
          includeActionSkills: true,
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
        skill?.handlerId === "engineer.kit-stow" ||
        skill?.handlerId === "engineer.photon-forge-exit" ||
        (context.weaponLine && context.entry?.name === "Swap Weapons")
      ) {
        return null;
      }
      return undefined;
    },
    resourceViews: (context: EngineerUiContext) => {
      const state = engineerUiState(context);
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
      return views;
    },
    paletteSkillAvailability: engineerCorePaletteSkillAvailability,
    isSlotSkillSelectable(
      _context: EngineerUiContext,
      skill: EngineerSkill,
    ): boolean {
      return (
        skill.slotSelectable !== false &&
        skill.handlerId !== "engineer.kit-stow" &&
        skill.flipParentId == null &&
        !String(skill.name || "").startsWith("Detonate") &&
        !UNSELECTABLE_SLOT_SKILLS.has(skill.name)
      );
    },
    weaponSwapChangesSet: false,
    eventLogRow: engineerEventLogRow,
  });

export function bindEngineerCoreUi(
  catalog: Readonly<CanonicalCatalog>,
): typeof engineerCoreUi {
  engineerSkills = catalog.skills as readonly EngineerSkill[];
  engineerSkillsById = catalog.skillsById as ReadonlyMap<
    SkillId,
    EngineerSkill
  >;
  engineerTraits = catalog.traits;
  return engineerCoreUi;
}
