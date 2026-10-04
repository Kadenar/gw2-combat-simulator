import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import type { Skill as PreviewSkill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  SkillDamagePreviewContext,
  SkillDamageState
} from '#gw2/platform/profession-presentation/skill-damage.js';
import { activeRevenantLegend, revenantUiState } from '#gw2/professions/revenant/core/presentation.js';
import { REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { HERALD_MECHANICS } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import type { RevenantUiSlice } from '#gw2/professions/revenant/types.js';

const TRUE_NATURE_IDS: readonly SkillId[] = Object.freeze(Object.values(HERALD_MECHANICS.trueNatureConsumeByLegendId));

export const heraldUi: RevenantUiSlice = Object.freeze({
  /** Declare the damage context for one assumed occurrence. */
  skillDamageState(_context: SkillDamagePreviewContext, input: PreviewSkill): SkillDamageState | null {
    // Direct evaluation supplies damage state without prerequisite actions.
    const legend = Object.entries(HERALD_MECHANICS.trueNatureConsumeByLegendId).find(([, id]) => id === input.id)?.[0];
    return legend ? { config: { startingLegend: legend } } : null;
  },

  // Tile identity follows the active bar even when the visible skill cannot currently be cast.
  paletteOverride: (context, skill) => {
    if (!TRUE_NATURE_IDS.includes(skill.id)) return;
    return {
      tileActive:
        skill.id ===
          (HERALD_MECHANICS.trueNatureConsumeByLegendId as Readonly<Record<string, SkillId>>)[
            activeRevenantLegend(context)
          ] && skillFlipReady(revenantUiState(context).availableFlips?.[skill.id], context.time || 0)
    };
  },
  paletteGroups: () => {
    return [
      {
        id: 'revenant-profession-specialization',
        label: 'F',
        // All legend variants declare one family; shared projection selects the
        // active legend's consume only while that flip is armed.
        skillIds: [SKILL.FACET_OF_NATURE, ...TRUE_NATURE_IDS],
        color: '#a84f54',
        resourceAnchor: true
      }
    ];
  },
  // Herald has no custom resource bar; it reuses the Energy bar declared in core/presentation.ts.
  resourceViews: () => []
});
