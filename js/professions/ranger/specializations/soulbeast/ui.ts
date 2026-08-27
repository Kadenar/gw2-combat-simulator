import { RANGER_SKILL_IDS as ID } from '../../data/ids.js';
import { rangerPetPaletteGroup, rangerUiState, selectedRangerUiPet } from '../../core/ui.js';
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord,
  SkillId
} from '../../../../platform/engine/types.js';
import type { RangerSkill, RangerUiContext } from '../../types.js';

// Populated lazily at bind time from the catalog; can't be a const because the catalog isn't available at module load.
let beastmodeSkillIds = new Set<SkillId>();
const BEASTMODE_TOGGLE_IDS = new Set<SkillId>([ID.BEASTMODE, ID.LEAVE_BEASTMODE]);
const SOULBEAST_HIDDEN_EVENT_TYPES = new Set(['ranger.beastmode', 'ranger.boon-extension']);

function beastmodeActive(context: RangerUiContext): boolean {
  // Treat missing state as active: initial state starts in Beastmode, so undefined means merged.
  return rangerUiState(context).beastmodeActive !== false;
}

function availability(context: RangerUiContext, skill: RangerSkill): PaletteSkillAvailability {
  const active = beastmodeActive(context);
  if (skill.petSkill && active) {
    return { available: false, message: 'Leave Beastmode first' };
  }

  const selectedSkillIds = selectedRangerUiPet(context)?.beastmodeSkillIds || [];
  // A beast skill exists in the catalog for every pet, but only the selected pet's
  // merged skills should be usable — block the rest before checking the mode flag.
  if (beastmodeSkillIds.has(skill.id) && !BEASTMODE_TOGGLE_IDS.has(skill.id) && !selectedSkillIds.includes(skill.id)) {
    return {
      available: false,
      message: 'Select the pet that grants this merged Beast skill'
    };
  }

  if (skill.beastmodeSkill && !active && skill.id !== ID.BEASTMODE) {
    return { available: false, message: 'Enter Beastmode first' };
  }

  if (skill.id === ID.BEASTMODE && active) {
    return { available: false, message: 'Beastmode is already active' };
  }

  if (skill.id === ID.LEAVE_BEASTMODE && !active) {
    return { available: false, message: 'Beastmode is not active' };
  }

  return { available: true, message: '' };
}

function paletteGroups(context: RangerUiContext): ProfessionPaletteGroup[] {
  const active = beastmodeActive(context);
  const groups: ProfessionPaletteGroup[] = [
    {
      id: 'ranger-soulbeast-profession',
      label: 'Beastmode',
      // Declare both toggle sides and let the shared projector choose one.
      skillIds: [
        ID.BEASTMODE,
        ID.LEAVE_BEASTMODE,
        ...(active ? selectedRangerUiPet(context)?.beastmodeSkillIds || [] : [])
      ],
      color: '#b78b42',
      resourceAnchor: true
    }
  ];
  // Pet palette is only meaningful when unmerged — in Beastmode the pet's skills are subsumed into beast skills.
  if (!active) groups.push(rangerPetPaletteGroup(context));
  return groups;
}

/** Shows One Wolf Pack only while its extra-strike window remains active. */
function soulbeastStateSnapshot(context: RangerUiContext): RotationStateSnapshotItem[] {
  const remaining = Number(rangerUiState(context).oneWolfPackUntil || 0) - Math.max(0, Number(context.atSeconds || 0));
  return remaining > 0
    ? [
        {
          id: 'soulbeast-one-wolf-pack',
          label: 'One Wolf Pack',
          value: `${remaining.toFixed(1)}s`,
          title: 'Time remaining in One Wolf Pack'
        }
      ]
    : [];
}

export const soulbeastUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  skillBarGroups: (context: RangerUiContext) => [
    {
      id: 'ranger-soulbeast-f5',
      label: 'Beastmode',
      // The Beastmode section holds the merge toggle plus both pets' merged Beast skills,
      // which used to render on the pet portrait cards.
      skillIds: [
        beastmodeActive(context) ? ID.LEAVE_BEASTMODE : ID.BEASTMODE,
        ...(selectedRangerUiPet(context, 1)?.beastmodeSkillIds || []),
        ...(selectedRangerUiPet(context, 2)?.beastmodeSkillIds || [])
      ],
      color: '#b78b42',
      className: 'ranger-soulbeast-beastmode'
    }
  ],
  paletteGroups,
  paletteSkillAvailability: availability,
  rotationStateSnapshot: soulbeastStateSnapshot,
  // Return null (suppress) for internal bookkeeping events that have no meaningful display to the user.
  eventLogRow: (_context: RangerUiContext, event: SchedulerRecord) =>
    SOULBEAST_HIDDEN_EVENT_TYPES.has(String(event.type)) ? null : undefined
});

export function bindSoulbeastUi(catalog: Readonly<CanonicalCatalog>) {
  beastmodeSkillIds = new Set(catalog.skills.filter((skill) => skill.beastmodeSkill).map((skill) => skill.id));
  return soulbeastUi;
}
