import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { thiefUiState } from '#gw2/professions/thief/core/presentation.js';
import type { ThiefSkill, ThiefUiContext } from '#gw2/professions/thief/types.js';

const SHADOW_SHROUD_SKILL_IDS = Object.freeze([
  ID.HAUNT_SHOT,
  ID.GRASPING_SHADOWS,
  ID.DAWNS_REPOSE,
  ID.ETERNAL_NIGHT,
  ID.MIND_SHOCK
]);

export const specterUi = Object.freeze({
  paletteGroups: () => [
    {
      id: 'thief-profession',
      label: 'F',
      skillIds: [ID.SIPHON, ID.ENTER_SHADOW_SHROUD, ID.EXIT_SHADOW_SHROUD],
      color: '#9a535c',
      className: 'compact-resource-palette specter-f-skills',
      resourceAnchor: true,
      stackId: 'specter-profession'
    },
    {
      id: 'thief-shadow-shroud',
      label: 'Sh',
      skillIds: SHADOW_SHROUD_SKILL_IDS,
      color: '#6b9988',
      className: 'specter-shroud-skills',
      stackId: 'specter-profession'
    }
  ],
  skillBarGroups: () => [
    {
      id: 'specter-f-keys',
      label: 'F Keys',
      skillIds: [ID.SIPHON, ID.ENTER_SHADOW_SHROUD, ID.EXIT_SHADOW_SHROUD],
      color: '#9a535c',
      layout: 'thief-shadow-shroud'
    },
    {
      id: 'specter-shadow-shroud',
      label: 'Shadow Shroud',
      skillIds: SHADOW_SHROUD_SKILL_IDS,
      color: '#6b9988',
      layout: 'thief-shadow-shroud'
    }
  ],
  resourceViews: (context: ThiefUiContext) => {
    const state = thiefUiState(context);
    return [
      {
        id: 'shadow-force',
        singular: 'shadow force',
        plural: 'shadow force',
        maximum: 100,
        value: Number(state.shadowForce ?? context.initialShadowForce ?? 0),
        startMaximum: 100,
        canStart: true,
        buildKey: 'initialShadowForce',
        step: 1,
        displayMode: 'bar',
        pipStyle: 'compact-profession-resource-specter-shadow-force',
        shortLabel: 'SF',
        // Label changes while shroud is active to signal the bar is draining.
        statusLabel: state.shadowShroudActive ? 'Shroud' : 'Current'
      }
    ];
  },
  paletteSkillAvailability: (context: ThiefUiContext, skill: ThiefSkill) => {
    const state = thiefUiState(context);
    if (skill.id === ID.ENTER_SHADOW_SHROUD) {
      const available = !state.shadowShroudActive && Number(state.shadowForce || 0) > 0;
      return {
        available,
        message: available
          ? ''
          : state.shadowShroudActive
            ? 'Shadow Shroud is already active'
            : 'Use Siphon or spend initiative to gain shadow force'
      };
    }

    if (skill.id === ID.EXIT_SHADOW_SHROUD) {
      return {
        available: Boolean(state.shadowShroudActive),
        message: state.shadowShroudActive ? '' : 'Enter Shadow Shroud first'
      };
    }

    if (skill.shadowShroudSkill && !state.shadowShroudActive) {
      return { available: false, message: 'Enter Shadow Shroud first' };
    }

    if (
      state.shadowShroudActive &&
      !skill.shadowShroudSkill &&
      (skill.type === 'Weapon' || ['Heal', 'Utility', 'Elite'].includes(skill.type || ''))
    ) {
      return {
        available: false,
        message: 'Shadow Shroud replaces weapon and slot skills'
      };
    }

    return { available: true, message: '' };
  }
});
