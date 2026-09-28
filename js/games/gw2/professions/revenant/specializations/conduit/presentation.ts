import { REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { activeRevenantLegend, revenantUiState } from '#gw2/professions/revenant/core/presentation.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import type { RevenantUiContext, RevenantUiSlice } from '#gw2/professions/revenant/types.js';

/** Reports both the legend-derived Cosmic Wisdom form and its remaining duration. */
function conduitStateSnapshot(context: RevenantUiContext): RotationStateSnapshotItem[] {
  const state = revenantUiState(context);
  const remaining = (state.cosmicWisdomUntil || 0) - Math.max(0, context.atSeconds || 0);
  return remaining > 0 && state.conduitForm
    ? [
        {
          id: 'conduit-cosmic-wisdom',
          label: 'Cosmic Wisdom',
          value: `${state.conduitForm} · ${remaining.toFixed(1)}s`,
          title: 'Active Cosmic Wisdom form and time remaining'
        }
      ]
    : [];
}

export const conduitUi: RevenantUiSlice = Object.freeze({
  rotationStateSnapshot: conduitStateSnapshot,
  paletteGroups: (context: RevenantUiContext) => {
    // Release Potential variant depends on the currently active legend, so the palette rebuilds on legend swap.
    const releaseId = REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND[activeRevenantLegend(context)];
    return [
      {
        id: 'revenant-profession-specialization',
        label: 'F',
        skillIds: [
          // Release Potential is omitted when the active legend has no mapped variant (e.g. no legend selected).
          ...(releaseId == null ? [] : [releaseId]),
          SKILL.COSMIC_WISDOM
        ],
        color: '#a84f54',
        resourceAnchor: true,
        // Affinity powers the Conduit profession skills, so keep its pips
        // directly above those F skills while Energy stays with the legends.
        resourceIds: ['affinity'],
        resourcePlacement: 'above' as const
      }
    ];
  },
  resourceViews: (context: RevenantUiContext) => [
    {
      id: 'affinity',
      singular: 'affinity',
      plural: 'affinity',
      maximum: 5,
      value: revenantUiState(context).affinity || 0,
      // Affinity cannot be manually set by the user; it is always gained through gameplay actions.
      canStart: false,
      step: 1,
      displayMode: 'pips',
      pipStyle: 'revenant-affinity',
      shortLabel: 'Aff',
      statusLabel: 'Current'
    }
  ]
});
