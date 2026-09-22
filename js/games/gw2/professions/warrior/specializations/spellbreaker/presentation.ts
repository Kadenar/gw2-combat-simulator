import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  formatSecondsRemaining,
  warriorAdrenalineResourceViews,
  warriorBurstPaletteAvailability,
  warriorPaletteGroups,
  warriorSnapshotAt,
  warriorUiState
} from '#gw2/professions/warrior/core/presentation.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import type { WarriorSkill, WarriorUiContext, WarriorUiSlice } from '#gw2/professions/warrior/types.js';

const SKILLS = Object.freeze([ID.FULL_COUNTER]);
export const spellbreakerUi: WarriorUiSlice = Object.freeze({
  paletteGroups: (context: WarriorUiContext) => warriorPaletteGroups(context, SKILLS),
  resourceViews: (context: WarriorUiContext) => warriorAdrenalineResourceViews(context, 20),
  paletteSkillAvailability: (context: WarriorUiContext, skill: WarriorSkill) =>
    warriorBurstPaletteAvailability(context, skill),
  rotationStateSnapshot: (context: WarriorUiContext) => {
    const state = warriorUiState(context);
    const at = warriorSnapshotAt(context);
    const items: RotationStateSnapshotItem[] = [];
    const insight = activeStackCount(state.attackerInsightExpiries || [], at);
    if (insight > 0) {
      items.push({
        id: 'attackers-insight',
        label: "Attacker's Insight",
        value: `${insight}`,
        title: "Attacker's Insight stacks currently active"
      });
    }

    const tether = Number(state.magebaneTetherUntil || 0) - at;
    if (tether > 0) {
      items.push({
        id: 'magebane-tether',
        label: 'Magebane Tether',
        value: formatSecondsRemaining(tether),
        title: 'Magebane Tether remaining on the target'
      });
    }

    return items;
  }
});
