import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { heraldFacetPassive } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';

/** Dragon Nature adds duration after the normal cap without changing Concentration. */
export const heraldAttributes: Gw2AttributeContributionCalculator = (context) => {
  const core = revenantRuntimeCoreState(context);
  const state = revenantRuntimeSpecializationState(context, 'Herald');

  const passive = heraldFacetPassive(core, state, ID.FACET_OF_NATURE, context.time);

  if (!passive) return [];

  return [
    {
      uncappedBoonDuration: passive.legendId === LEGEND.DRAGON ? 20 : 0
    }
  ];
};
