import { WARRIOR_SKILL_IDS as ID } from '../../data/ids.js';
import {
  formatSecondsRemaining,
  warriorPaletteGroups,
  warriorSkillBarGroups,
  warriorSnapshotAt,
  warriorUiState
} from '../../core/ui.js';
import type { ProfessionUiContract, RotationStateSnapshotItem } from '../../../../platform/engine/types.js';
import type { WarriorUiContext } from '../../types.js';

const SKILLS = Object.freeze([ID.BERSERK]);

export const berserkerUi: Partial<ProfessionUiContract> = Object.freeze({
  paletteGroups: (context: WarriorUiContext) => warriorPaletteGroups(context, SKILLS),
  skillBarGroups: (context: WarriorUiContext) => warriorSkillBarGroups(context, SKILLS),
  rotationStateSnapshot: (context: WarriorUiContext) => {
    const state = warriorUiState(context);
    const remaining = Number(state.berserkUntil || 0) - warriorSnapshotAt(context);
    if (!state.berserkActive || remaining <= 0) return [];
    const items: RotationStateSnapshotItem[] = [
      {
        id: 'berserk',
        label: 'Berserk',
        value: formatSecondsRemaining(remaining),
        title: 'Time remaining in Berserk mode'
      }
    ];
    return items;
  }
});
