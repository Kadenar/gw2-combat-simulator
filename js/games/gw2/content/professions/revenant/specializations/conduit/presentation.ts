import { REVENANT_SKILL_IDS as SKILL } from '../../data/ids.js';
import { REVENANT_RELEASE_POTENTIAL_BY_LEGEND } from '../../legend-rules.js';
import { activeRevenantLegend, revenantUiState } from '../../core/presentation.js';
import type {
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord,
  SkillId
} from '../../../../../platform/engine/types.js';
import type { RevenantUiContext } from '../../types.js';

// Bridges the string-keyed legend map to skill IDs; the legend map returns names, not IDs.
const RELEASE_ID_BY_NAME: Readonly<Record<string, SkillId>> = Object.freeze({
  'Release Potential: Monk': SKILL.RELEASE_POTENTIAL_MONK,
  'Release Potential: Mesmer': SKILL.RELEASE_POTENTIAL_MESMER,
  'Release Potential: Dervish': SKILL.RELEASE_POTENTIAL_DERVISH,
  'Release Potential: Assassin': SKILL.RELEASE_POTENTIAL_ASSASSIN,
  'Release Potential: Warrior': SKILL.RELEASE_POTENTIAL_WARRIOR
});

/** Reports both the legend-derived Cosmic Wisdom form and its remaining duration. */
function conduitStateSnapshot(context: RevenantUiContext): RotationStateSnapshotItem[] {
  const state = revenantUiState(context);
  const remaining = Number(state.cosmicWisdomUntil || 0) - Math.max(0, Number(context.atSeconds || 0));
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

export const conduitUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  rotationStateSnapshot: conduitStateSnapshot,
  paletteGroups: (context: RevenantUiContext) => {
    // Release Potential variant depends on the currently active legend, so the palette rebuilds on legend swap.
    const releaseName = REVENANT_RELEASE_POTENTIAL_BY_LEGEND[activeRevenantLegend(context)];
    const releaseId = releaseName ? RELEASE_ID_BY_NAME[releaseName] : null;
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
      value: Number(revenantUiState(context).affinity || 0),
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
