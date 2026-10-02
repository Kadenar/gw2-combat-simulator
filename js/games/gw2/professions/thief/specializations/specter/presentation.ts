import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { thiefUiState } from '#gw2/professions/thief/core/presentation.js';
import type { ThiefUiContext, ThiefSkill } from '#gw2/professions/thief/types.js';

const SHADOW_SHROUD_SKILL_IDS = Object.freeze([
  ID.HAUNT_SHOT,
  ID.GRASPING_SHADOWS,
  ID.DAWNS_REPOSE,
  ID.ETERNAL_NIGHT,
  ID.MIND_SHOCK
]);

export const specterUi = Object.freeze({
  // Mode identity remains visible independently of remaining Shadow Force.
  paletteOverride: (context: ThiefUiContext, skill: ThiefSkill) => {
    if (skill.id === ID.ENTER_SHADOW_SHROUD || skill.id === ID.EXIT_SHADOW_SHROUD)
      return { tileActive: (skill.id === ID.EXIT_SHADOW_SHROUD) === Boolean(thiefUiState(context).shadowShroudActive) };
  },
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
  resourceViews: (context: ThiefUiContext) => {
    const state = thiefUiState(context);
    return [
      {
        id: 'shadow-force',
        singular: 'shadow force',
        plural: 'shadow force',
        maximum: 100,
        value: state.shadowClock?.value ?? context.initialShadowForce ?? 0,
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
  }
});
