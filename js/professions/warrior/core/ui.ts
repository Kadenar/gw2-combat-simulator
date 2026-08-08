import { flattenProfessionState } from "../../../platform/engine/profession.js";
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from "../../../app/simulation/randomness.js";
import { WARRIOR_SKILL_IDS as ID } from "../data/ids.js";
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionUiContract,
} from "../../../platform/engine/types.js";
import type { WarriorSkill, WarriorState, WarriorUiContext } from "../types.js";

let warriorCatalog: Readonly<CanonicalCatalog>;

const REGULAR_BURSTS_BY_WEAPON: Readonly<Record<string, number>> =
  Object.freeze({
    Axe: ID.EVISCERATE,
    Dagger: ID.BREACHING_STRIKE,
    Greatsword: ID.ARCING_SLICE,
    Hammer: ID.EARTHSHAKER,
    Longbow: ID.COMBUSTIVE_SHOT,
    Mace: ID.SKULL_CRACK,
    Rifle: ID.KILL_SHOT,
    Spear: ID.HARRIERS_TOSS,
    Staff: ID.PATH_TO_VICTORY,
    Sword: ID.BLOODTHIRSTER,
  });

const PRIMAL_BURSTS_BY_WEAPON: Readonly<Record<string, number>> = Object.freeze(
  {
    Axe: ID.DECAPITATE,
    Dagger: ID.SLICING_MAELSTROM,
    Greatsword: ID.ARC_DIVIDER,
    Hammer: ID.RUPTURING_SMASH,
    Longbow: ID.SCORCHED_EARTH,
    Mace: ID.SKULL_GRINDER,
    Rifle: ID.GUN_FLAME,
    Spear: ID.WILD_THROW,
    Staff: ID.RAMPART_SPLITTER,
    Sword: ID.FLAMING_FLURRY,
  },
);

export function warriorUiState(
  context: WarriorUiContext = {},
): Partial<WarriorState> {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  ) as Partial<WarriorState>;
}

export function warriorUiSpecialization(
  context: WarriorUiContext = {},
): string {
  return context.specialization || context.config?.specialization || "Core";
}

export function warriorBurstSkillIds(): number[] {
  return warriorCatalog.skills
    .filter(
      (skill) =>
        skill.burst &&
        !skill.primalBurst &&
        !skill.dragonSlash &&
        skill.implemented &&
        !skill.simulatorExcluded,
    )
    .map((skill) => Number(skill.id));
}

function burstMapForSpecialization(
  specialization: string,
): Readonly<Record<string, number>> {
  return specialization === "Berserker"
    ? PRIMAL_BURSTS_BY_WEAPON
    : REGULAR_BURSTS_BY_WEAPON;
}

function selectedPrimaryWeapon(
  context: WarriorUiContext,
  weaponSet: 1 | 2,
): string {
  if (context.build) {
    return String(
      weaponSet === 1
        ? context.build.weapons?.[0] || ""
        : context.build.alternateWeapons?.[0] || "",
    );
  }
  return String(
    weaponSet === 1
      ? context.config?.primaryWeapon || ""
      : context.config?.weaponSet2Primary || "",
  );
}

function weaponSetBurstSkillId(
  context: WarriorUiContext,
  weaponSet: 1 | 2,
): number | undefined {
  const specialization = warriorUiSpecialization(context);
  if (specialization === "Bladesworn") return undefined;
  return burstMapForSpecialization(specialization)[
    selectedPrimaryWeapon(context, weaponSet)
  ];
}

function warriorProfessionSkillIds(
  context: WarriorUiContext,
  professionSkillIds: readonly number[],
): number[] {
  const specialization = warriorUiSpecialization(context);
  const weaponBursts =
    specialization === "Bladesworn"
      ? []
      : ([1, 2] as const)
          .map((weaponSet) => weaponSetBurstSkillId(context, weaponSet))
          .filter((skillId): skillId is number => Number.isFinite(skillId));
  return [...new Set([...weaponBursts, ...professionSkillIds])];
}

export function warriorPaletteGroups(
  context: WarriorUiContext,
  professionSkillIds: readonly number[] = [],
): ProfessionPaletteGroup[] {
  const skillIds = warriorProfessionSkillIds(context, professionSkillIds);
  return [
    {
      id: "profession",
      label: "F",
      skillIds,
      color: "#d79b55",
      resourceAnchor: true,
    },
    {
      id: "warrior-actions",
      label: "Act",
      skillIds: [ID.SWAP_WEAPONS],
      color: "#e0ad70",
    },
  ];
}

export function warriorSkillBarGroups(
  context: WarriorUiContext,
  professionSkillIds: readonly number[] = [],
): ProfessionSkillBarGroup[] {
  return [
    {
      id: "warrior-f-keys",
      label: "F Keys",
      skillIds: warriorProfessionSkillIds(context, professionSkillIds),
      color: "#d79b55",
      className: "warrior-burst-f-keys",
      layout: "warrior-burst",
    },
  ];
}

function resourceViews(context: WarriorUiContext): ProfessionResourceView[] {
  if (warriorUiSpecialization(context) === "Bladesworn") return [];
  const state = warriorUiState(context);
  return [
    {
      id: "adrenaline",
      singular: "adrenaline",
      plural: "adrenaline",
      maximum: Number(state.maximumAdrenaline || 30),
      value: Number(
        state.adrenaline ?? state.resource ?? context.initialResource ?? 0,
      ),
      startMaximum: Number(state.maximumAdrenaline || 30),
      startValue: Number(context.initialResource ?? 0),
      canStart: true,
      buildKey: "initialResource",
      step: 1,
      displayMode: "bar",
      barSegments: Math.max(1, Number(state.maximumAdrenaline || 30) / 10),
      pipStyle: "warrior-adrenaline",
      shortLabel: "Adr",
      statusLabel: "Current",
    },
  ];
}

function availability(
  context: WarriorUiContext,
  skill: WarriorSkill,
): PaletteSkillAvailability {
  const specialization = warriorUiSpecialization(context);
  const state = warriorUiState(context);
  const activeWeaponSet = Number(context.activeWeaponSet) === 2 ? 2 : 1;
  const activeBurstSkillId = weaponSetBurstSkillId(context, activeWeaponSet);
  const weaponSetBurstIds = ([1, 2] as const).map((weaponSet) =>
    weaponSetBurstSkillId(context, weaponSet),
  );
  if (
    weaponSetBurstIds.includes(Number(skill.id)) &&
    activeBurstSkillId !== Number(skill.id)
  ) {
    const requiredWeaponSet = weaponSetBurstIds.indexOf(Number(skill.id)) + 1;
    return {
      available: false,
      message: `Switch to weapon set ${requiredWeaponSet}`,
    };
  }
  if (skill.primalBurst && !state.berserkActive)
    return { available: false, message: "Enter berserk mode first" };
  if (skill.gunsaberSkill) {
    if (specialization !== "Bladesworn")
      return { available: false, message: "Requires Bladesworn" };
    if (skill.dragonSlash && !state.dragonTriggerActive) {
      return { available: false, message: "Enter Dragon Trigger first" };
    }
    if (!skill.dragonSlash && !state.gunsaberActive)
      return { available: false, message: "Unsheathe the gunsaber first" };
  }
  if (
    specialization === "Bladesworn" &&
    state.gunsaberActive &&
    skill.type === "Weapon" &&
    Boolean(skill.weapon)
  ) {
    return { available: false, message: "Sheathe the gunsaber first" };
  }
  if (skill.id === ID.UNSHEATHE_GUNSABER && state.gunsaberActive) {
    return { available: false, message: "Gunsaber is already active" };
  }
  if (skill.id === ID.SHEATHE_GUNSABER && !state.gunsaberActive) {
    return { available: false, message: "Gunsaber is not active" };
  }
  return { available: true, message: "" };
}

export const warriorCoreUi: Partial<ProfessionUiContract> = Object.freeze({
  assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  paletteGroups: (context) =>
    warriorUiSpecialization(context) === "Core"
      ? warriorPaletteGroups(context)
      : [],
  skillBarGroups: (context) =>
    warriorUiSpecialization(context) === "Core"
      ? warriorSkillBarGroups(context)
      : [],
  resourceViews,
  paletteSkillAvailability: availability,
  targetHealthThresholds: () => [0.8, 0.5, 0.25],
});

export function bindWarriorCoreUi(
  catalog: Readonly<CanonicalCatalog>,
): typeof warriorCoreUi {
  warriorCatalog = catalog;
  return warriorCoreUi;
}
