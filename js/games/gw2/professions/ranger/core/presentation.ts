import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/builds/randomness-assumptions.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { WEAPON } from '#gw2/platform/constants.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { uiSpecialization } from '#gw2/platform/profession-presentation/compose.js';
import type {
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionSkillBarGroup
} from '#gw2/platform/profession-presentation/types.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import { RANGER_ASSUMPTION_CONTROLS } from '#gw2/professions/ranger/build/assumptions.js';
import { rangerPetAutoProfile } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { rangerPetSkillTiming } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import {
  RANGER_SPEAR_STEALTH_FLIP_BY_PARENT,
  rangerSpearStealthAvailable
} from '#gw2/professions/ranger/core/mechanics/weapon-state.js';
import type { RangerCoreState } from '#gw2/professions/ranger/core/state.js';
import {
  normalizeRangerHammerSkillIds,
  RANGER_HAMMER_VARIANT_PAIRS,
  rangerHammerUsesBuildSelection
} from '#gw2/professions/ranger/data/hammer-variants.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetCommandBar } from '#gw2/professions/ranger/data/pet-commands.js';
import {
  isRangerPetName,
  RANGER_DEFAULT_PET_NAMES,
  rangerPetByName,
  rangerPetForState
} from '#gw2/professions/ranger/data/pets.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import type {
  RangerPlanningState,
  RangerSkill,
  RangerUiContext,
  RangerUiSelection,
  RangerUiSlice
} from '#gw2/professions/ranger/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

const RANGER_HIDDEN_EVENT_TYPES = new Set([
  'ranger.poison-master-armed',
  'ranger.blood-thirst',
  // The marker delegates to the trait-owned siphon, which supplies the visible damage event.
  'ranger.natural-fortitude',
  'ranger.pet-swapped',
  'ranger.poisonous-strikes',
  'ranger.sharpening-stone'
]);

// Boon-copy mechanics retain their simulation events without duplicating whole boon lists in the readable log.
const RANGER_HIDDEN_BOON_SOURCES = new Set<number>([TRAIT.FORTIFYING_BOND, TRAIT.RESOUNDING_TIMBRE, ID.WE_HEAL_AS_ONE]);

export function rangerUiState(context: RangerUiContext): Partial<RangerPlanningState> {
  // Presentation callers supply the flat projection for the inspected rotation point.
  return context.professionState ?? {};
}

function commandablePetSkillIds(catalog: Readonly<CanonicalCatalog<RangerSkill>>, context: RangerUiContext): SkillId[] {
  return rangerPetCommandBar(activeRangerUiPet(context).skillIds, catalog.skillsById, uiSpecialization(context));
}

interface RangerPetPaletteGroupOptions {
  readonly resourceAnchor?: boolean;
  readonly stackId?: string;
}

export function rangerPetPaletteGroup(
  catalog: Readonly<CanonicalCatalog<RangerSkill>>,
  context: RangerUiContext,
  options: RangerPetPaletteGroupOptions = {}
): ProfessionPaletteGroup {
  const activePet = activeRangerUiPet(context);
  return {
    id: 'ranger-pet',
    label: 'Pet',
    skillIds: [...commandablePetSkillIds(catalog, context), ID.PET_SWAP],
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

// Resolve a valid pet for either UI slot from current build state, falling back to
// the profession defaults when a saved name is stale.
function selectedRangerUiPet(context: RangerUiContext, slot: 1 | 2 = 1) {
  const state = rangerUiState(context);
  const selected =
    slot === 2
      ? context.build?.selectedPet2 ||
        context.config?.selectedPet2 ||
        state[STATE.PET_NAMES]?.[1] ||
        RANGER_DEFAULT_PET_NAMES[1]
      : context.build?.selectedPet ||
        context.config?.selectedPet ||
        state[STATE.PET_NAMES]?.[0] ||
        RANGER_DEFAULT_PET_NAMES[0];
  return rangerPetByName(selected);
}

/** Live pet identity owns combat palettes; detached previews use the configured selection. */
export function activeRangerUiPet(context: RangerUiContext) {
  const state = rangerUiState(context);
  const petNames = state[STATE.PET_NAMES];
  const activePetSlot = state[STATE.ACTIVE_PET_SLOT];
  return petNames && activePetSlot ? rangerPetForState({ petNames, activePetSlot }) : selectedRangerUiPet(context);
}

function updatePetSelection(context: RangerUiContext, selection: RangerUiSelection): boolean {
  if (!['selectedPet', 'selectedPet2'].includes(String(selection.key)) || !context.build) return false;

  if (!isRangerPetName(selection.value)) return false;

  if (selection.key === 'selectedPet2') context.build.selectedPet2 = selection.value;
  else context.build.selectedPet = selection.value;

  return true;
}

function selectedHammerSkillIds(context: RangerUiContext): number[] {
  return normalizeRangerHammerSkillIds(context.build?.selectedHammerSkillIds || context.config?.selectedHammerSkillIds);
}

function hasHammerEquipped(context: RangerUiContext): boolean {
  return [
    ...(context.build?.weapons || []),
    ...(context.build?.alternateWeapons || []),
    ...gw2ConfiguredWeaponSet(context.config, 1),
    ...gw2ConfiguredWeaponSet(context.config, 2)
  ].includes(WEAPON.HAMMER);
}

// Replace exactly one hammer variant pair in build state after validating the
// selected skill belongs to that slot.
function updateHammerSelection(context: RangerUiContext, selection: RangerUiSelection): boolean {
  if (selection.key !== 'selectedHammerSkillIds' || !context.build || !rangerHammerUsesBuildSelection(context)) {
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

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindRangerCoreUi(catalog: Readonly<CanonicalCatalog<RangerSkill>>): RangerUiSlice {
  return Object.freeze({
    /** Declare this module's conditional inputs without adding simulation settings. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);
      // Expose held combat bonuses to isolated damage calculations.
      preview.damageBuff('Light on your Feet', 'lightOnYourFeet', 'light-on-your-feet');

      if (preview.has("Hunter's Tactics"))
        preview.add({
          key: 'flanking',
          label: 'Flanking',
          group: 'Trait conditionals',
          kind: 'special',
          description: 'Positional Critical Chance'
        });

      preview.passives(ID.SIGNET_OF_THE_WILD);
      return preview.controls;
    },
    /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
    prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
      // Opening Strike is a single-hit bonus, so it does not belong in persistent attribute previews.
      const { player } = readProfessionCoreState<RangerCoreState>(context.professionState);

      if (player) player.openingStrikeReady = false;
    },

    // Tile identity follows the active bar even when the visible skill cannot currently be cast.
    paletteOverride: (context, skill) => {
      const flip = RANGER_SPEAR_STEALTH_FLIP_BY_PARENT[Number(skill.id)];
      const stealth = Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT).includes(Number(skill.id));

      if (stealth || flip != null)
        return {
          tileActive:
            stealth ===
            rangerSpearStealthAvailable(
              {
                availableFlips: rangerUiState(context)[STATE.AVAILABLE_FLIPS],
                stealthStartedAt: rangerUiState(context)[STATE.STEALTH_STARTED_AT],
                stealthUntil: rangerUiState(context)[STATE.STEALTH_UNTIL],
                revealedUntil: rangerUiState(context)[STATE.REVEALED_UNTIL]
              },
              context.time || 0
            )
        };
    },
    assumptionControls: [
      ...RANGER_ASSUMPTION_CONTROLS,
      ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
      ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS
    ],
    skillBarGroups: (context: RangerUiContext) => {
      const pet = selectedRangerUiPet(context);
      const pet2 = selectedRangerUiPet(context, 2);
      const specialization = uiSpecialization(context);
      // Put supported pets first, with alphabetical choices within each combat-support section.
      const petOptions = RANGER_PETS.map((option) => {
        const profile = rangerPetAutoProfile(option.name);
        // Flag missing autonomous impact measurements independently of combat support; utility skills need none.
        const missingImpacts = profile
          ? [
              ...new Set(
                [profile.basic, ...(profile.opening ? [profile.opening] : []), ...profile.specials].map(
                  (skill) => skill.id
                )
              )
            ]
              .filter((id) =>
                catalog.skillsById
                  .get(id)
                  ?.effects?.some((effect) => ['strike', 'condition', 'control'].includes(effect.type))
              )
              .filter((id) => !Object.keys(rangerPetSkillTiming(option.name, id)?.unbuffedImpactMs ?? {}).length)
              .map((id) => catalog.skillsById.get(id)!.name)
          : [];
        const supported = profile !== null;
        return {
          value: option.name,
          label: option.name,
          wikiPage: `Juvenile ${option.name}`,
          icon: option.icon,
          description: option.description,
          group: supported ? 'Supported' : 'Unsupported',
          warning: !supported
            ? `${option.name} is not modeled.`
            : missingImpacts.length
              ? `${option.name} lacks calibrated autonomous impact timing for: ${missingImpacts.join(', ')}.`
              : undefined
        };
      }).sort((a, b) => a.group.localeCompare(b.group, 'en') || a.label.localeCompare(b.label, 'en'));
      // Each specialization gets a stable layout hook without Core naming specific elite mechanics.
      const layout =
        specialization === 'Core'
          ? 'ranger-mechanics'
          : `ranger-mechanics ranger-${specialization.toLowerCase()}-mechanics`;
      // Name each pet selector with the chosen pet and leave combat skills to the rotation palette.
      const groups: ProfessionSkillBarGroup[] = [
        {
          id: 'ranger-pet-1-selection',
          label: pet.name,
          skillIds: [],
          selections: [
            {
              optionEntries: petOptions,
              filterPlaceholder: 'Filter pets...',
              selectionValue: pet.name,
              selectionKey: 'selectedPet',
              selectionIndex: 0
            }
          ],
          color: '#7ca64a',
          // Use the simulation's profiles so the notice follows support for the selected pets.
          className: `ranger-pet ranger-pet-1${rangerPetAutoProfile(pet.name) ? '' : ' ranger-pet-unmodeled'}`,
          layout
        },
        {
          id: 'ranger-pet-2-selection',
          label: pet2.name,
          skillIds: [],
          selections: [
            {
              optionEntries: petOptions,
              filterPlaceholder: 'Filter pets...',
              selectionValue: pet2.name,
              selectionKey: 'selectedPet2',
              selectionIndex: 1
            }
          ],
          color: '#7ca64a',
          className: `ranger-pet ranger-pet-2${rangerPetAutoProfile(pet2.name) ? '' : ' ranger-pet-unmodeled'}`,
          layout
        }
      ];

      // State-controlled hammer bars do not expose independent build selections.
      if (rangerHammerUsesBuildSelection(context) && hasHammerEquipped(context)) {
        const selected = selectedHammerSkillIds(context);
        groups.push({
          id: 'ranger-hammer-selection',
          label: WEAPON.HAMMER,
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
      if (uiSpecialization(context) !== 'Core') return [];

      return [rangerPetPaletteGroup(catalog, context, { resourceAnchor: true })];
    },
    resourceViews: (context: RangerUiContext): ProfessionResourceView[] => {
      const state = rangerUiState(context);
      return [
        {
          id: 'endurance',
          singular: 'endurance',
          plural: 'endurance',
          maximum: state[STATE.ENDURANCE]?.maximum ?? context.resources!.endurance!.maximum,
          value: state[STATE.ENDURANCE]?.value ?? ENDURANCE.maximum,
          startMaximum: ENDURANCE.maximum,
          canStart: false,
          step: 1,
          displayMode: 'bar',
          shortLabel: 'End',
          statusLabel: 'Current',
          paletteSkillId: SHARED_SKILL_IDS.DODGE
        }
      ];
    },
    eventLogRow: (_context: RangerUiContext, event: SimulationEvent) =>
      RANGER_HIDDEN_EVENT_TYPES.has(event.type) ||
      (event.type === 'buff' && RANGER_HIDDEN_BOON_SOURCES.has(Number(event.sourceId)))
        ? null
        : undefined
  });
}
