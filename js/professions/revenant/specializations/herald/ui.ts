import { REVENANT_SKILL_IDS as SKILL } from '../../data/ids.js';
import { activeRevenantLegend, revenantUiState } from '../../core/ui.js';
import { HERALD_MECHANICS } from './mechanics.js';
import type { ProfessionUiContract, SchedulerRecord, SkillId } from '../../../../platform/engine/types.js';
import type { RevenantUiContext } from '../../types.js';

export const heraldUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  paletteGroups: (context: RevenantUiContext) => {
    // True Nature's skill ID differs per active legend; look it up before deciding which button to show.
    const trueNatureId = (HERALD_MECHANICS.trueNatureConsumeByLegendId as Readonly<Record<string, SkillId>>)[
      activeRevenantLegend(context)
    ];
    return [
      {
        id: 'revenant-profession-specialization',
        label: 'F',
        skillIds: [
          // Show the legend-specific True Nature only when Facet of Nature is already active (flip registered); otherwise show the activating facet.
          trueNatureId != null && revenantUiState(context).availableFlips?.[trueNatureId]
            ? trueNatureId
            : SKILL.FACET_OF_NATURE
        ],
        color: '#a84f54',
        resourceAnchor: true
      }
    ];
  },
  // Herald has no custom resource bar; it reuses the core Energy bar declared in revenantCoreUi.
  resourceViews: () => []
});
