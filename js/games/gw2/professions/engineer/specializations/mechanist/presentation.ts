import { engineerUiState } from '#gw2/professions/engineer/core/presentation.js';
import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import { selectedMechCommands } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type { ProfessionUiContract } from '#gw2/platform/engine/profession/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { EngineerResolverEvent, EngineerUiContext } from '#gw2/professions/engineer/types.js';

// Prefer the editable build's traits, but fall back to simulation state when a
// historical result is inspected without a complete build projection.
function mechanistCommandSkills(context: EngineerUiContext): SkillId[] {
  const activeTraits = getActiveTraits(context.build?.specializations || []);
  return activeTraits.length
    ? selectedMechCommands(new Set(activeTraits.flatMap((trait) => [trait.id, trait.name])))
    : [...(engineerUiState(context).mech?.commandSkillIds || [])];
}

export const mechanistUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  eventLogRow: (_context: EngineerUiContext, event: EngineerResolverEvent) =>
    event?.type === 'engineer.state' ? null : undefined,
  paletteGroups: (context: EngineerUiContext) => [
    {
      id: 'engineer-profession',
      label: 'F',
      // The mech stays present, so the profession bar only exposes its three commands.
      skillIds: mechanistCommandSkills(context),
      color: '#b88a35',
      className: 'engineer-profession-skills',
      resourceAnchor: true,
      includeActionSkills: true
    }
  ]
});
