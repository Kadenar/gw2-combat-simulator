import { RANGER_SKILL_IDS as ID } from '../../data/ids.js';
import { rangerPetPaletteGroup, rangerUiState } from '../../core/ui.js';
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId
} from '../../../../platform/engine/types.js';
import type { RangerSkill, RangerUiContext } from '../../types.js';

// Module-level cache populated once in bindUntamedUi; avoids filtering the catalog on every render.
let petSkillIds: SkillId[] = [];
let untamedCatalog: Readonly<CanonicalCatalog>;

function initialUntamedState(context: RangerUiContext): 'Pet' | 'Ranger' {
  return context.build?.initialUntamedState === 'Ranger' || context.config?.initialUntamedState === 'Ranger'
    ? 'Ranger'
    : 'Pet';
}

function stateOption(value: 'Pet' | 'Ranger', skillId: SkillId) {
  const skill = untamedCatalog.skillsById.get(skillId);
  return {
    value,
    label: `Unleashed ${value}`,
    icon: skill?.icon || '',
    description: `Begin the rotation with the ${value.toLowerCase()} unleashed.`
  };
}

function availability(context: RangerUiContext, skill: RangerSkill): PaletteSkillAvailability {
  const state = rangerUiState(context);
  const rangerUnleashed = Boolean(state.rangerUnleashed);
  if (skill.id === ID.UNLEASH_RANGER && rangerUnleashed) {
    return { available: false, message: 'Ranger is already unleashed' };
  }

  if (skill.id === ID.UNLEASH_PET && !rangerUnleashed) {
    return { available: false, message: 'Pet is already unleashed' };
  }

  if (skill.unleashedPetSkill && rangerUnleashed) {
    return { available: false, message: 'Unleash Pet first' };
  }

  if (skill.unleashedAmbushSkill) {
    if (!rangerUnleashed) {
      return { available: false, message: 'Unleash Ranger first' };
    }

    // ambushReadyUntil is a deadline; once current time passes it the window is gone.
    if (Number(context.time || 0) >= Number(state.ambushReadyUntil || 0)) {
      return {
        available: false,
        message: 'Unleash to make an ambush available'
      };
    }
  }

  return { available: true, message: '' };
}

const untamedUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  skillBarGroups: (context: RangerUiContext) => [
    {
      id: 'ranger-untamed-f5',
      label: 'Unleash',
      // Show whichever Unleash skill is currently usable; the two skills share the same F5 slot.
      skillIds: [rangerUiState(context).rangerUnleashed ? ID.UNLEASH_PET : ID.UNLEASH_RANGER],
      color: '#3f9b64',
      className: 'ranger-untamed-unleash'
    },
    {
      id: 'ranger-untamed-pet',
      label: 'Unleashed Pet',
      skillIds: petSkillIds,
      color: '#3f9b64',
      className: 'ranger-untamed-pet-skills'
    }
  ],
  startControls: (context: RangerUiContext) => [
    {
      id: 'ranger-untamed-start-state',
      label: 'Start unleashed',
      buildKey: 'initialUntamedState',
      value: initialUntamedState(context),
      options: [stateOption('Pet', ID.UNLEASH_PET), stateOption('Ranger', ID.UNLEASH_RANGER)],
      color: '#3f9b64'
    }
  ],
  paletteGroups: (context: RangerUiContext) => [
    rangerPetPaletteGroup(context),
    {
      id: 'ranger-untamed-profession',
      label: 'Unleash',
      skillIds: [ID.UNLEASH_RANGER, ID.UNLEASH_PET, ...petSkillIds],
      color: '#3f9b64',
      resourceAnchor: true
    }
  ],
  paletteSkillAvailability: availability,
  // Unleash synchronization is internal state bookkeeping, not a player-facing combat event.
  eventLogRow: (_context: RangerUiContext, event: SchedulerRecord) =>
    event.type === 'ranger.untamed-state' ? null : undefined
});

export function bindUntamedUi(catalog: Readonly<CanonicalCatalog>) {
  untamedCatalog = catalog;
  petSkillIds = catalog.skills.filter((skill) => skill.unleashedPetSkill).map((skill) => skill.id);
  return untamedUi;
}
