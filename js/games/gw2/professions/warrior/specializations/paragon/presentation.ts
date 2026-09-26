import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import {
  warriorAdrenalineResourceViews,
  warriorBurstPaletteAvailability,
  warriorPaletteGroups,
  warriorUiState
} from '#gw2/professions/warrior/core/presentation.js';
import type { ProfessionResourceView, RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import type { WarriorSkill, WarriorUiContext, WarriorUiSlice } from '#gw2/professions/warrior/types.js';

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

/** Shows the refrain currently pulsing while Paragon still has motivation to sustain it. */
function paragonStateSnapshot(context: WarriorUiContext): RotationStateSnapshotItem[] {
  const state = warriorUiState(context);
  const refrain = String(state.activeRefrain || '');
  return refrain && Number(state.motivation || 0) > 0
    ? [
        {
          id: 'paragon-active-refrain',
          label: 'Active Refrain',
          value: refrain,
          title: 'Refrain currently consuming Motivation on each pulse'
        }
      ]
    : [];
}

export const paragonUi: WarriorUiSlice = Object.freeze({
  // Put chants on their own F row so Motivation can sit beside them while adrenaline stays above weapon bursts.
  paletteGroups: (context: WarriorUiContext) => {
    const [bursts, ...otherGroups] = warriorPaletteGroups(context);
    return [
      { ...bursts, stackId: 'paragon-profession', className: `${bursts.className} paragon-f-skills` },
      {
        id: 'paragon-chants',
        label: 'F',
        skillIds: CHANTS,
        color: '#d79b55',
        stackId: 'paragon-profession',
        className: 'paragon-chants'
      },
      ...otherGroups
    ];
  },
  rotationStateSnapshot: paragonStateSnapshot,
  resourceViews: resources,
  paletteSkillAvailability: (context: WarriorUiContext, skill: WarriorSkill) =>
    warriorBurstPaletteAvailability(context, skill)
});
