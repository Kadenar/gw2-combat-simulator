import {
  engineerFSkillBarGroups,
  engineerToolbeltSkillIds,
  namedSkillId,
  uniqueIdsBySkillName
} from '#gw2/professions/engineer/core/presentation.js';
import type {
  ProfessionEventLogDescriptor,
  ProfessionUiContract,
  SchedulerRecord
} from '#gw2/platform/engine/types.js';
import type { EngineerResolverEvent, EngineerUiContext } from '#gw2/professions/engineer/types.js';

// First 4 toolbelt slots + Function Gyro as the F5 mechanic skill.
function scrapperProfessionSkills(context: EngineerUiContext) {
  return [...engineerToolbeltSkillIds(context).slice(0, 4), namedSkillId('Function Gyro')];
}

// null = hide from the event log; undefined = fall through to default rendering.
// Internal pulse bookkeeping and state events are not meaningful to the user.
function scrapperEventLogRow(
  _context: EngineerUiContext,
  event: EngineerResolverEvent
): ProfessionEventLogDescriptor | null | undefined {
  return ['engineer.mass-momentum-pulse', 'engineer.state'].includes(event?.type) ? null : undefined;
}

export const scrapperUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  eventLogRow: scrapperEventLogRow,
  skillBarGroups: (context: EngineerUiContext) => engineerFSkillBarGroups(scrapperProfessionSkills(context)),
  paletteGroups: (context: EngineerUiContext) => [
    {
      id: 'engineer-profession',
      label: 'F',
      skillIds: uniqueIdsBySkillName(scrapperProfessionSkills(context).filter((id) => id != null)),
      color: '#b88a35',
      className: 'engineer-profession-skills',
      resourceAnchor: true,
      includeActionSkills: true
    }
  ]
});
