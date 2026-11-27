import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type {
  ProfessionStateSnapshotContext,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { activeRevenantLegend, revenantUiState } from '#gw2/professions/revenant/core/presentation.js';
import { REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import {
  normalizeRevenantLegendIds,
  REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND
} from '#gw2/professions/revenant/data/legends.js';
import { maximumConduitAffinity } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import type { ConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RevenantUiContext, RevenantUiSlice } from '#gw2/professions/revenant/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

/** Reports both the legend-derived Cosmic Wisdom form and its remaining duration. */
function conduitStateSnapshot(
  context: ProfessionStateSnapshotContext<RevenantUiContext['professionState']>
): RotationStateSnapshotItem[] {
  const state = revenantUiState(context);
  const remaining = (state[STATE.COSMIC_WISDOM_UNTIL] || 0) - Math.max(0, context.atSeconds || 0);
  return remaining > 0 && state[STATE.CONDUIT_FORM]
    ? [
        {
          id: 'conduit-cosmic-wisdom',
          label: 'Cosmic Wisdom',
          value: `${state[STATE.CONDUIT_FORM]} · ${remaining.toFixed(1)}s`,
          title: 'Active Cosmic Wisdom form and time remaining'
        }
      ]
    : [];
}

export const conduitUi: RevenantUiSlice = Object.freeze({
  /** Both equipped legends contribute a release to the damage preview. */
  skillDamageGroups({ build, specialization }: ProfessionAttributePreviewContext) {
    const legends = normalizeRevenantLegendIds(build.selectedLegends, specialization);
    return [
      {
        id: 'release-potential',
        title: 'Release Potential',
        skillIds: legends.map((legend) => REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND[legend])
      }
    ];
  },
  /** Measure each release with its legend active so legend-dependent effects use the correct state. */
  skillDamageState(_context: ProfessionAttributePreviewContext, skill: Skill) {
    const legend = Object.entries(REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND).find(([, id]) => id === skill.id)?.[0];
    return legend ? { config: { startingLegend: legend } } : null;
  },
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.add({
      key: 'affinity',
      scope: ['damage'],
      label: 'Affinity',
      kind: 'special',
      group: 'Mechanic',
      max: maximumConduitAffinity(context.catalog),
      description: 'Stored stacks before the skill activates'
    });
    preview.add({
      key: 'cosmicWisdom',
      scope: ['attributes', 'damage'],
      label: 'Cosmic Wisdom',
      kind: 'special',
      group: 'Other buffs',
      description: 'Cosmic Wisdom form and Bolstered Bonds attributes'
    });
    return preview.controls;
  },
  /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    readProfessionSpecializationState<ConduitState>(context.professionState, 'Conduit')!.cosmicWisdomUntil = context
      .values.cosmicWisdom
      ? 60
      : 0;
  },

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
      // Runtime meters use the canonical cap; build-only controls read the same selected profile.
      maximum: revenantUiState(context)[STATE.AFFINITY]?.maximum ?? maximumConduitAffinity(context.catalog),
      value: revenantUiState(context)[STATE.AFFINITY]?.value ?? 0,
      // Rotations gain Affinity through combat actions.
      canStart: false,
      step: 1,
      displayMode: 'pips',
      pipStyle: 'revenant-affinity',
      shortLabel: 'Aff',
      statusLabel: 'Current'
    }
  ]
});
