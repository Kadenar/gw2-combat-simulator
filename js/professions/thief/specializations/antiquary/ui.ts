import { flattenProfessionState } from '../../../../platform/engine/profession.js';
import { THIEF_ANTIQUARY_ASSUMPTION_CONTROLS } from './assumptions.js';
import { THIEF_ARTIFACT_IDS, THIEF_SKILL_IDS as ID } from '../../data/ids.js';
import type { ThiefSkill, ThiefState, ThiefUiContext } from '../../types.js';

function stateFrom(context: ThiefUiContext = {}): Partial<ThiefState> {
  return flattenProfessionState(context.state?.profession || context.professionState) as unknown as Partial<ThiefState>;
}

export const antiquaryUi = Object.freeze({
  assumptionControls: THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
  paletteGroups: () => {
    const artifactGroups: readonly [string, string, readonly number[], string][] = [
      ['thief-artifacts-offensive', 'Offensive', THIEF_ARTIFACT_IDS.OFFENSIVE, '#c65d68'],
      ['thief-artifacts-defensive', 'Defensive', THIEF_ARTIFACT_IDS.DEFENSIVE, '#6f9cb8']
    ];
    return [
      {
        id: 'thief-profession',
        label: 'F',
        skillIds: [ID.SKRITT_SWIPE],
        color: '#9a535c',
        resourceAnchor: true,
        // Shares the artifact stack so CSS can seat the offensive/defensive
        // rows beside Skritt Swipe rather than stacking them below it.
        className: 'antiquary-f-skill',
        stackId: 'thief-artifacts'
      },
      ...artifactGroups.map(([id, label, artifactIds, color]) => ({
        id,
        label,
        // Always list every artifact; paletteSkillAvailability greys out the
        // ones that are not pilfered yet or already spent this pilfer, so a
        // used artifact stays visible but disabled instead of disappearing.
        skillIds: [...artifactIds],
        color,
        stackId: 'thief-artifacts',
        className: `antiquary-artifact-group antiquary-${id.replace('thief-', '')}`
      }))
    ];
  },
  skillBarGroups: () => [
    {
      id: 'thief-artifacts-offensive',
      label: 'Offensive Artifacts',
      skillIds: [...THIEF_ARTIFACT_IDS.OFFENSIVE],
      color: '#c65d68'
    },
    {
      id: 'thief-artifacts-defensive',
      label: 'Defensive Artifacts',
      skillIds: [...THIEF_ARTIFACT_IDS.DEFENSIVE],
      color: '#6f9cb8'
    }
  ],
  // Available artifact uses are a backend gate (state.artifactUsesRemaining),
  // not a palette meter, so Antiquary contributes no artifact resource view.
  paletteSkillAvailability: (context: ThiefUiContext, skill: ThiefSkill) => {
    const state = stateFrom(context);
    if (skill.artifactKind) {
      const hasUse = Number(state.artifactUsesRemaining || 0) > 0;
      const inSlot = Boolean(state.artifactSlots?.some((slot) => slot.skillId === skill.id));
      return {
        available: hasUse && inSlot,
        message:
          hasUse && inSlot
            ? ''
            : !hasUse
              ? 'Pilfer with Skritt Swipe before using an artifact'
              : 'This artifact was already used this pilfer'
      };
    }
    if (skill.id === ID.RESHUFFLE) {
      // Reshuffle is always greyed-out in the palette; it is queue-only and blocked by availability when there is nothing to reroll
      return {
        available: false,
        message: 'All artifacts are already available to choose'
      };
    }
    return { available: true, message: '' };
  }
});
