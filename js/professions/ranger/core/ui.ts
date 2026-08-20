import { flattenProfessionState } from '../../../platform/engine/profession.js';
import { defaultWeaponSkillMatchesSet } from '../../../platform/gw2/weapon-skill-matcher.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '../../../app/simulation/randomness.js';
import { RANGER_ASSUMPTION_CONTROLS } from '../assumptions.js';
import { RANGER_SKILL_IDS as ID } from '../data/ids.js';
import { RANGER_PETS } from '../data/ranger-pet-data.js';
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
  SkillId
} from '../../../platform/engine/types.js';
import type { RangerSkill, RangerUiContext, RangerUiSelection } from '../types.js';
import { isRangerHammerVariant, normalizeRangerHammerSkillIds, RANGER_HAMMER_VARIANT_PAIRS } from './hammer.js';
import { RANGER_SPEAR_STEALTH_FLIP_BY_PARENT } from './weapon-state.js';

let rangerCatalog: Readonly<CanonicalCatalog>;

const RANGER_HIDDEN_EVENT_TYPES = new Set([
  'ranger.beast-skill-used',
  'ranger.blood-thirst',
  'ranger.pet-swapped',
  'ranger.poisonous-strikes',
  'ranger.sharpening-stone',
  'ranger.winter-bite-ready'
]);

export function rangerUiState(context: RangerUiContext): SchedulerRecord {
  return flattenProfessionState(context.state?.profession || context.professionState || {});
}

export function rangerUiSpecialization(context: RangerUiContext): string {
  return context.specialization || context.config?.specialization || 'Core';
}

export function rangerNamedSkillIds(names: readonly string[]): SkillId[] {
  return names.flatMap((name) => {
    const id = rangerCatalog.skillsByName.get(name)?.id;
    return id == null ? [] : [id];
  });
}

function activePetSkillIds(context: RangerUiContext): SkillId[] {
  const state = rangerUiState(context);
  if (Array.isArray(state.activePetSkillIds)) {
    return [...(state.activePetSkillIds as SkillId[])];
  }

  return [...(selectedRangerUiPet(context)?.skillIds || [])];
}

function commandableSkillIds(skillIds: readonly SkillId[]): SkillId[] {
  return skillIds.filter(
    (skillId) => !(rangerCatalog.skillsById.get(skillId) as RangerSkill | undefined)?.petAutonomousSkill
  );
}

function commandablePetSkillIds(context: RangerUiContext): SkillId[] {
  return commandableSkillIds(activePetSkillIds(context));
}

interface RangerPetPaletteGroupOptions {
  readonly resourceAnchor?: boolean;
  readonly stackId?: string;
}

export function rangerPetPaletteGroup(
  context: RangerUiContext,
  options: RangerPetPaletteGroupOptions = {}
): ProfessionPaletteGroup {
  const activePet = activeRangerUiPet(context);
  return {
    id: 'ranger-pet',
    label: 'Pet',
    skillIds: [...commandablePetSkillIds(context), ID.PET_SWAP],
    color: '#7ca64a',
    resourceAnchor: options.resourceAnchor === true,
    stackId: options.stackId,
    includeActionSkills: true,
    statusIcon: {
      icon: activePet.icon,
      label: activePet.name,
      title: `Active pet: ${activePet.name}`
    }
  };
}

export function selectedRangerUiPet(context: RangerUiContext, slot: 1 | 2 = 1) {
  const state = rangerUiState(context);
  const selected = String(
    slot === 2
      ? context.build?.selectedPet2 ||
          context.config?.selectedPet2 ||
          (state.petNames as string[] | undefined)?.[1] ||
          'Lynx'
      : context.build?.selectedPet ||
          context.config?.selectedPet ||
          (state.petNames as string[] | undefined)?.[0] ||
          state.activePet
  );
  return RANGER_PETS.find((pet) => pet.name === selected) || RANGER_PETS[0];
}

export function activeRangerUiPet(context: RangerUiContext) {
  const activePet = String(rangerUiState(context).activePet || selectedRangerUiPet(context)?.name || '');
  return RANGER_PETS.find((pet) => pet.name === activePet) || RANGER_PETS[0];
}

function updatePetSelection(context: RangerUiContext, selection: RangerUiSelection): boolean {
  if (!['selectedPet', 'selectedPet2'].includes(String(selection.key)) || !context.build) return false;
  const pet = RANGER_PETS.find((candidate) => candidate.name === selection.value);
  if (!pet) return false;
  if (selection.key === 'selectedPet2') context.build.selectedPet2 = pet.name;
  else context.build.selectedPet = pet.name;
  return true;
}

function selectedHammerSkillIds(context: RangerUiContext): number[] {
  return normalizeRangerHammerSkillIds(context.build?.selectedHammerSkillIds || context.config?.selectedHammerSkillIds);
}

function hasHammerEquipped(context: RangerUiContext): boolean {
  return [
    ...(context.build?.weapons || []),
    ...(context.build?.alternateWeapons || []),
    context.config?.primaryWeapon,
    context.config?.secondaryWeapon,
    context.config?.weaponSet2Primary,
    context.config?.weaponSet2Secondary
  ].includes('Hammer');
}

function updateHammerSelection(context: RangerUiContext, selection: RangerUiSelection): boolean {
  if (selection.key !== 'selectedHammerSkillIds' || !context.build) {
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

function updateRangerCoreSelection(context: RangerUiContext, selection: RangerUiSelection): boolean {
  return updatePetSelection(context, selection) || updateHammerSelection(context, selection);
}

function rangerWeaponSkillMatchesSet(skill: Skill, weapons: string[], context: SchedulerRecord): boolean {
  if (
    isRangerHammerVariant(skill.id) &&
    !selectedHammerSkillIds(context as RangerUiContext).includes(Number(skill.id))
  ) {
    return false;
  }

  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}

function rangerCorePaletteAvailability(context: RangerUiContext, skill: RangerSkill): PaletteSkillAvailability {
  if (isRangerHammerVariant(skill.id) && !selectedHammerSkillIds(context).includes(Number(skill.id))) {
    return { available: false, message: 'Select this Hammer variant first' };
  }

  const state = rangerUiState(context);
  const availableFlips = (state.availableFlips || {}) as SchedulerRecord;
  const flipParent = skill.flipParentId == null ? null : rangerCatalog.skillsById.get(Number(skill.flipParentId));
  const spearStealthFlipId = RANGER_SPEAR_STEALTH_FLIP_BY_PARENT[Number(skill.id)];
  const isSpearStealthAttack = Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT).includes(Number(skill.id));
  if (
    skill.type === 'Weapon' &&
    !isRangerHammerVariant(skill.id) &&
    (flipParent?.flipSkillId === skill.id || isSpearStealthAttack) &&
    Number(availableFlips[String(skill.id)] || 0) <= Number(context.time || 0)
  ) {
    return { available: false, message: `Use ${flipParent?.name || 'its opening weapon skill'} first` };
  }

  if (
    skill.type === 'Weapon' &&
    !isRangerHammerVariant(skill.id) &&
    ((skill.flipSkillId != null &&
      skill.flipSkillId !== skill.nextChainId &&
      Number(availableFlips[String(skill.flipSkillId)] || 0) > Number(context.time || 0)) ||
      (spearStealthFlipId != null &&
        Number(availableFlips[String(spearStealthFlipId)] || 0) > Number(context.time || 0)))
  ) {
    return { available: false, message: 'Use or wait out the active follow-up skill' };
  }

  if (!skill.petSkill) return { available: true, message: '' };
  const available = !skill.petAutonomousSkill && activePetSkillIds(context).includes(skill.id);
  return {
    available,
    message: available
      ? ''
      : skill.petAutonomousSkill
        ? 'The active pet uses this skill automatically'
        : `Select the pet that owns this ${skill.petFamilySkill ? 'family attack' : 'Beast skill'}`
  };
}

export const rangerCoreUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  assumptionControls: [...RANGER_ASSUMPTION_CONTROLS, ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS],
  skillBarGroups: (context: RangerUiContext) => {
    const pet = selectedRangerUiPet(context);
    const pet2 = selectedRangerUiPet(context, 2);
    const specialization = rangerUiSpecialization(context);
    const petOptions = RANGER_PETS.map((option) => ({
      value: option.name,
      label: option.name,
      icon: option.icon,
      description: option.description
    }));
    // Each specialization gets a stable layout hook without Core naming specific elite mechanics.
    const layout =
      specialization === 'Core'
        ? 'ranger-mechanics'
        : `ranger-mechanics ranger-${specialization.toLowerCase()}-mechanics`;
    const groups: ProfessionSkillBarGroup[] = [
      {
        id: 'ranger-pet-1-selection',
        label: 'Pet 1',
        skillIds: [],
        selections: [
          {
            optionEntries: petOptions,
            filterPlaceholder: 'Filter pets...',
            selectionValue: pet?.name || '',
            selectionKey: 'selectedPet',
            selectionIndex: 0,
            // Caption the enlarged portrait with the picked pet's name across every specialization.
            typeLabel: pet?.name,
            skillIds: commandableSkillIds(pet?.skillIds || [])
          }
        ],
        color: '#7ca64a',
        className: 'ranger-pet ranger-pet-1',
        layout
      },
      {
        id: 'ranger-pet-2-selection',
        label: 'Pet 2',
        skillIds: [],
        selections: [
          {
            optionEntries: petOptions,
            filterPlaceholder: 'Filter pets...',
            selectionValue: pet2?.name || '',
            selectionKey: 'selectedPet2',
            selectionIndex: 1,
            // Caption the enlarged portrait with the picked pet's name across every specialization.
            typeLabel: pet2?.name,
            skillIds: commandableSkillIds(pet2?.skillIds || [])
          }
        ],
        color: '#7ca64a',
        className: 'ranger-pet ranger-pet-2',
        layout
      }
    ];
    if (hasHammerEquipped(context)) {
      const selected = selectedHammerSkillIds(context);
      groups.push({
        id: 'ranger-hammer-selection',
        label: 'Hammer',
        skillIds: [],
        selections: RANGER_HAMMER_VARIANT_PAIRS.map((pair, index) => ({
          skillId: selected[index],
          optionSkillIds: pair,
          selectionKey: 'selectedHammerSkillIds',
          selectionIndex: index
        })),
        color: '#7ca64a',
        className: 'ranger-hammer'
      });
    }

    return groups;
  },
  updateSkillBarSelection: updateRangerCoreSelection,
  paletteGroups: (context: RangerUiContext) => {
    if (rangerUiSpecialization(context) !== 'Core') return [];
    return [rangerPetPaletteGroup(context, { resourceAnchor: true })];
  },
  resourceViews: (context: RangerUiContext): ProfessionResourceView[] => {
    const state = rangerUiState(context);
    return [
      {
        id: 'endurance',
        singular: 'endurance',
        plural: 'endurance',
        maximum: Number(state.maximumEndurance || 100),
        value: Number(state.endurance ?? 100),
        startMaximum: 100,
        startValue: 100,
        canStart: false,
        step: 1,
        displayMode: 'bar',
        shortLabel: 'End',
        statusLabel: 'Current',
        paletteSkillId: ID.DODGE
      }
    ];
  },
  paletteSkillAvailability: rangerCorePaletteAvailability,
  weaponSkillMatchesSet: rangerWeaponSkillMatchesSet,
  eventLogRow: (_context: RangerUiContext, event: SchedulerRecord) =>
    RANGER_HIDDEN_EVENT_TYPES.has(String(event.type)) ? null : undefined
});

export function bindRangerCoreUi(catalog: Readonly<CanonicalCatalog>) {
  rangerCatalog = catalog;
  return rangerCoreUi;
}
