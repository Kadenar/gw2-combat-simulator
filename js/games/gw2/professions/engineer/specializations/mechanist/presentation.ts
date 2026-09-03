import {
  engineerFSkillBarGroups,
  engineerUiState,
  namedSkillId,
  uniqueIdsBySkillName
} from '#gw2/professions/engineer/core/presentation.js';
import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { selectedMechCommands } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type {
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId
} from '#gw2/platform/engine/types.js';
import type { EngineerResolverEvent, EngineerUiContext } from '#gw2/professions/engineer/types.js';

// Prefer the editable build's traits, but fall back to simulation state when a
// historical result is inspected without a complete build projection.
function mechanistCommandSkills(context: EngineerUiContext): SkillId[] {
  const activeTraits = getActiveTraits(context.build?.specializations || []);
  return activeTraits.length
    ? selectedMechCommands(new Set(activeTraits.flatMap((trait) => [trait.id, trait.name])))
    : [...(engineerUiState(context).mech?.commandSkillIds || [])];
}

/** Builds the profession bar from the selected commands and the current mech toggle action. */
function mechanistProfessionSkills(context: EngineerUiContext) {
  const commands = mechanistCommandSkills(context);
  const mechActive = engineerUiState(context).mech?.active !== false;
  return [...commands, namedSkillId(mechActive ? 'Recall Mech' : 'Crash Down')];
}

// Only the live side of the summon/recall toggle is actionable; both remain in
// the palette so the shared projector can swap tiles without rebuilding groups.
function mechanistPaletteAvailability(
  context: EngineerUiContext,
  skill: { readonly id: SkillId }
): PaletteSkillAvailability {
  const active = engineerUiState(context).mech?.active !== false;
  if (skill.id === ID.CRASH_DOWN && active) {
    return { available: false, message: 'The jade mech is already active' };
  }

  if (skill.id === ID.RECALL_MECH && !active) {
    return { available: false, message: 'Summon the jade mech first' };
  }

  return { available: true, message: '' };
}

export const mechanistUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  eventLogRow: (_context: EngineerUiContext, event: EngineerResolverEvent) =>
    event?.type === 'engineer.state' ? null : undefined,
  skillBarGroups: (context: EngineerUiContext) => engineerFSkillBarGroups(mechanistProfessionSkills(context)),
  paletteGroups: (context: EngineerUiContext) => [
    {
      id: 'engineer-profession',
      label: 'F',
      // Both sides are declared; the shared projector selects the live mech tile.
      skillIds: uniqueIdsBySkillName(
        [...mechanistCommandSkills(context), namedSkillId('Crash Down'), namedSkillId('Recall Mech')].filter(
          (skillId): skillId is SkillId => skillId != null
        )
      ),
      color: '#b88a35',
      className: 'engineer-profession-skills',
      resourceAnchor: true,
      includeActionSkills: true
    }
  ],
  paletteSkillAvailability: mechanistPaletteAvailability
});
