import { WARRIOR_SKILL_IDS as ID } from '../../data/ids.js';
import {
  formatSecondsRemaining,
  warriorAdrenalineResourceViews,
  warriorBurstPaletteAvailability,
  warriorPaletteGroups,
  warriorSkillBarGroups,
  warriorSnapshotAt,
  warriorUiState
} from '../../core/presentation.js';
import type {
  PaletteSkillAvailability,
  ProfessionUiContract,
  RotationStateSnapshotItem
} from '../../../../../platform/engine/types.js';
import type { WarriorSkill, WarriorUiContext } from '../../types.js';

const SKILLS = Object.freeze([ID.BERSERK]);
const PRIMAL_BURSTS_BY_WEAPON: Readonly<Record<string, number>> = Object.freeze({
  Axe: ID.DECAPITATE,
  Dagger: ID.SLICING_MAELSTROM,
  Greatsword: ID.ARC_DIVIDER,
  Hammer: ID.RUPTURING_SMASH,
  Longbow: ID.SCORCHED_EARTH,
  Mace: ID.SKULL_GRINDER,
  Rifle: ID.GUN_FLAME,
  Spear: ID.WILD_THROW,
  Staff: ID.RAMPART_SPLITTER,
  Sword: ID.FLAMING_FLURRY
});

/** Presents Berserker's primal replacement and active-mode palette gates. */
function availability(context: WarriorUiContext, skill: WarriorSkill): PaletteSkillAvailability {
  const burst = warriorBurstPaletteAvailability(context, skill, PRIMAL_BURSTS_BY_WEAPON);
  if (!burst.available) return burst;
  const state = warriorUiState(context);
  if (skill.primalBurst && !state.berserkActive) return { available: false, message: 'Enter berserk mode first' };
  if (skill.handlerId === 'warrior.berserk' && state.berserkActive) {
    return { available: false, message: 'Already in berserk mode' };
  }

  return { available: true, message: '' };
}

export const berserkerUi: Partial<ProfessionUiContract> = Object.freeze({
  paletteGroups: (context: WarriorUiContext) => warriorPaletteGroups(context, SKILLS, PRIMAL_BURSTS_BY_WEAPON),
  skillBarGroups: (context: WarriorUiContext) => warriorSkillBarGroups(context, SKILLS, PRIMAL_BURSTS_BY_WEAPON),
  resourceViews: warriorAdrenalineResourceViews,
  paletteSkillAvailability: availability,
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
