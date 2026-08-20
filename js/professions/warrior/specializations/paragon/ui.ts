import { WARRIOR_SKILL_IDS as ID } from '../../data/ids.js';
import {
  warriorAdrenalineResourceViews,
  warriorBurstPaletteAvailability,
  warriorPaletteGroups,
  warriorSkillBarGroups,
  warriorUiState
} from '../../core/ui.js';
import type {
  ProfessionResourceView,
  ProfessionUiContract,
  SimulationEvent
} from '../../../../platform/engine/types.js';
import type { WarriorSkill, WarriorUiContext } from '../../types.js';

const CHANTS = Object.freeze([ID.CHANT_OF_ACTION, ID.CHANT_OF_RECUPERATION, ID.CHANT_OF_FREEDOM]);

function resources(context: WarriorUiContext): ProfessionResourceView[] {
  const state = warriorUiState(context);
  return [
    ...warriorAdrenalineResourceViews(context),
    {
      id: 'motivation',
      singular: 'motivation',
      plural: 'motivation',
      maximum: 10,
      value: Number(state.motivation || 0),
      canStart: false,
      step: 1,
      displayMode: 'counter',
      pipStyle: 'warrior-motivation',
      shortLabel: 'Mot',
      statusLabel: 'Current'
    }
  ];
}

export const paragonUi: Partial<ProfessionUiContract> = Object.freeze({
  paletteGroups: (context: WarriorUiContext) => warriorPaletteGroups(context, CHANTS),
  skillBarGroups: (context: WarriorUiContext) => warriorSkillBarGroups(context, CHANTS),
  resourceViews: resources,
  paletteSkillAvailability: (context: WarriorUiContext, skill: WarriorSkill) =>
    warriorBurstPaletteAvailability(context, skill),
  // null hides the row; undefined defers to default rendering. Paragon-state
  // events are internal bookkeeping and should not appear in the event log.
  eventLogRow: (_context: WarriorUiContext, event: SimulationEvent) =>
    event.type === 'warrior.paragon-state' ? null : undefined
});
