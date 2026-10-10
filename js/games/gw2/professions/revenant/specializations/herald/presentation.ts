import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { Skill as PreviewSkill, SkillId } from '#gw2/platform/skills/types.js';
import type {
  SkillDamagePreviewContext,
  SkillDamageState
} from '#gw2/platform/profession-presentation/skill-damage.js';
import { activeRevenantLegend, revenantUiState } from '#gw2/professions/revenant/core/presentation.js';
import { REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill, RevenantUiContext, RevenantUiSlice } from '#gw2/professions/revenant/types.js';

/** Resolve every Nature projection from this selection, so changing catalogs cannot retain stale relationships. */
function natureConsumes(context: Pick<RevenantUiContext, 'catalog'>): Readonly<Record<string, SkillId>> {
  if (!context.catalog) throw new Error('Herald facet presentation requires the selected catalog.');
  const nature: RevenantSkill | undefined = context.catalog.skillsById.get(SKILL.FACET_OF_NATURE);
  return nature?.upkeepConsumeByLegendId ?? {};
}

export const heraldUi: RevenantUiSlice = Object.freeze({
  /** Expose held combat bonuses without changing the saved build or simulation. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.add({
      key: 'burstOfStrength',
      label: 'Burst of Strength',
      group: 'Other buffs',
      kind: 'buff',
      field: 'burst-of-strength',
      scope: ['damage'],
      description: 'Burst of Strength damage bonus active'
    });
    return preview.controls;
  },
  /** Declare the damage context for one assumed occurrence. */
  skillDamageState(context: SkillDamagePreviewContext, input: PreviewSkill): SkillDamageState | null {
    // Direct evaluation supplies damage state without prerequisite actions.
    const legend = Object.entries(natureConsumes(context)).find(([, id]) => id === input.id)?.[0];
    return legend ? { config: { startingLegend: legend } } : null;
  },

  // Tile identity follows the active bar even when the visible skill cannot currently be cast.
  paletteOverride: (context, skill) => {
    const consumes = natureConsumes(context);
    if (!Object.values(consumes).includes(skill.id)) return;
    return {
      tileActive:
        skill.id === consumes[activeRevenantLegend(context)] &&
        skillFlipReady(revenantUiState(context).availableFlips?.[skill.id], context.time || 0)
    };
  },
  paletteGroups: (context) => {
    return [
      {
        id: 'revenant-profession-specialization',
        label: 'F',
        // All legend variants declare one family; shared projection selects the
        // active legend's consume only while that flip is armed.
        skillIds: [SKILL.FACET_OF_NATURE, ...new Set(Object.values(natureConsumes(context)))],
        color: '#a84f54',
        resourceAnchor: true
      }
    ];
  },
  // Herald has no custom resource bar; it reuses the Energy bar declared in core/presentation.ts.
  resourceViews: () => []
});
