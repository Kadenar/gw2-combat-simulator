import { flattenProfessionState } from "../../../platform/engine/profession.js";
import { defaultWeaponSkillMatchesSet } from "../../../platform/gw2/weapon-skill-matcher.js";
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from "../../../app/simulation/randomness.js";
import { RANGER_ASSUMPTION_CONTROLS } from "../assumptions.js";
import { RANGER_SKILL_IDS as ID } from "../data/ids.js";
import { RANGER_PETS } from "../data/ranger-pet-data.js";
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  RangerSkill,
  RangerUiContext,
  RangerUiSelection,
} from "../types.js";
import {
  isRangerHammerVariant,
  normalizeRangerHammerSkillIds,
  RANGER_HAMMER_VARIANT_PAIRS,
} from "./hammer.js";

let rangerCatalog: Readonly<CanonicalCatalog>;

export function rangerUiState(context: RangerUiContext): SchedulerRecord {
  return flattenProfessionState(
    context.state?.profession || context.professionState || {},
  );
}

export function rangerUiSpecialization(context: RangerUiContext): string {
  return context.specialization || context.config?.specialization || "Core";
}

export function rangerNamedSkillIds(names: readonly string[]): SkillId[] {
  return names.flatMap((name) => {
    const id = rangerCatalog.skillsByName.get(name)?.id;
    return id == null ? [] : [id];
  });
}

function activePetSkillIds(context: RangerUiContext): SkillId[] {
  return [...(selectedRangerUiPet(context)?.skillIds || [])];
}

export function selectedRangerUiPet(context: RangerUiContext) {
  const state = rangerUiState(context);
  const selected = String(
    context.build?.selectedPet ||
      context.config?.selectedPet ||
      state.activePet,
  );
  return RANGER_PETS.find((pet) => pet.name === selected) || RANGER_PETS[0];
}

function updatePetSelection(
  context: RangerUiContext,
  selection: RangerUiSelection,
): boolean {
  if (selection.key !== "selectedPet" || !context.build) return false;
  const pet = RANGER_PETS.find(
    (candidate) => candidate.name === selection.value,
  );
  if (!pet) return false;
  context.build.selectedPet = pet.name;
  return true;
}

function selectedHammerSkillIds(context: RangerUiContext): number[] {
  return normalizeRangerHammerSkillIds(
    context.build?.selectedHammerSkillIds ||
      context.config?.selectedHammerSkillIds,
  );
}

function hasHammerEquipped(context: RangerUiContext): boolean {
  return [
    ...(context.build?.weapons || []),
    ...(context.build?.alternateWeapons || []),
    context.config?.primaryWeapon,
    context.config?.secondaryWeapon,
    context.config?.weaponSet2Primary,
    context.config?.weaponSet2Secondary,
  ].includes("Hammer");
}

function updateHammerSelection(
  context: RangerUiContext,
  selection: RangerUiSelection,
): boolean {
  if (selection.key !== "selectedHammerSkillIds" || !context.build) {
    return false;
  }
  const index = Number(selection.index);
  const skillId = Number(selection.skillId);
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= RANGER_HAMMER_VARIANT_PAIRS.length ||
    !RANGER_HAMMER_VARIANT_PAIRS[index].includes(skillId)
  ) {
    return false;
  }
  const selected = selectedHammerSkillIds(context);
  selected[index] = skillId;
  context.build.selectedHammerSkillIds = selected;
  return true;
}

function updateRangerCoreSelection(
  context: RangerUiContext,
  selection: RangerUiSelection,
): boolean {
  return (
    updatePetSelection(context, selection) ||
    updateHammerSelection(context, selection)
  );
}

function rangerWeaponSkillMatchesSet(
  skill: Skill,
  weapons: string[],
  context: SchedulerRecord,
): boolean {
  if (
    isRangerHammerVariant(skill.id) &&
    !selectedHammerSkillIds(context as RangerUiContext).includes(
      Number(skill.id),
    )
  ) {
    return false;
  }
  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}

function rangerCorePaletteAvailability(
  context: RangerUiContext,
  skill: RangerSkill,
): PaletteSkillAvailability {
  if (
    isRangerHammerVariant(skill.id) &&
    !selectedHammerSkillIds(context).includes(Number(skill.id))
  ) {
    return { available: false, message: "Select this Hammer variant first" };
  }
  if (!skill.petSkill) return { available: true, message: "" };
  const state = rangerUiState(context);
  if (state.beastmodeActive) {
    return { available: false, message: "Leave Beastmode first" };
  }
  const available = activePetSkillIds(context).includes(skill.id);
  return {
    available,
    message: available ? "" : "Select the pet that owns this Beast skill",
  };
}

export const rangerCoreUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    assumptionControls: [
      ...RANGER_ASSUMPTION_CONTROLS,
      ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
    ],
    skillBarGroups: (context: RangerUiContext) => {
      const pet = selectedRangerUiPet(context);
      const specialization = rangerUiSpecialization(context);
      const groups: ProfessionSkillBarGroup[] = [
        {
          id: "ranger-pet-selection",
          label: "Pet",
          skillIds:
            specialization === "Soulbeast"
              ? [...(pet?.beastmodeSkillIds || [])]
              : activePetSkillIds(context),
          selections: [
            {
              optionEntries: RANGER_PETS.map((option) => ({
                value: option.name,
                label: option.name,
                icon: option.icon,
                description: option.description,
              })),
              selectionValue: pet?.name || "",
              selectionKey: "selectedPet",
              selectionIndex: 0,
            },
          ],
          color: "#7ca64a",
          className: "ranger-pet",
          layout:
            specialization === "Untamed"
              ? "ranger-mechanics ranger-untamed-mechanics"
              : specialization === "Soulbeast"
                ? "ranger-mechanics ranger-soulbeast-mechanics"
                : "ranger-mechanics",
        },
      ];
      if (hasHammerEquipped(context)) {
        const selected = selectedHammerSkillIds(context);
        groups.push({
          id: "ranger-hammer-selection",
          label: "Hammer",
          skillIds: [],
          selections: RANGER_HAMMER_VARIANT_PAIRS.map((pair, index) => ({
            skillId: selected[index],
            optionSkillIds: pair,
            selectionKey: "selectedHammerSkillIds",
            selectionIndex: index,
          })),
          color: "#7ca64a",
          className: "ranger-hammer",
        });
      }
      return groups;
    },
    updateSkillBarSelection: updateRangerCoreSelection,
    paletteGroups: (context: RangerUiContext) => [
      ...(rangerUiSpecialization(context) === "Soulbeast"
        ? []
        : [
            {
              id: "ranger-pet",
              label: "Pet",
              skillIds: activePetSkillIds(context),
              color: "#7ca64a",
              resourceAnchor: rangerUiSpecialization(context) === "Core",
            },
          ]),
      {
        id: "ranger-actions",
        label: "Actions",
        skillIds: [ID.DODGE, ID.PET_SWAP, ID.SWAP_WEAPONS],
        color: "#7ca64a",
      },
    ],
    resourceViews: (context: RangerUiContext): ProfessionResourceView[] => {
      const state = rangerUiState(context);
      return [
        {
          id: "endurance",
          singular: "endurance",
          plural: "endurance",
          maximum: Number(state.maximumEndurance || 100),
          value: Number(state.endurance ?? 100),
          startMaximum: 100,
          startValue: 100,
          canStart: false,
          step: 1,
          displayMode: "bar",
          shortLabel: "End",
          statusLabel: "Current",
        },
      ];
    },
    paletteSkillAvailability: rangerCorePaletteAvailability,
    weaponSkillMatchesSet: rangerWeaponSkillMatchesSet,
  });

export function bindRangerCoreUi(catalog: Readonly<CanonicalCatalog>) {
  rangerCatalog = catalog;
  return rangerCoreUi;
}
