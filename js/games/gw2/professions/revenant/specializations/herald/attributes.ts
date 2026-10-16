import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { heraldFacetPassiveActive } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';

/** Dragon Nature adds duration after the normal cap without changing Concentration. */
export const heraldAttributes: Gw2AttributeContributionCalculator = (context) => {
  const core = revenantRuntimeCoreState(context);
  const state = revenantRuntimeSpecializationState(context, 'Herald') as Partial<HeraldState>;

  if (!heraldFacetPassiveActive(core, state, ID.FACET_OF_NATURE, context.time)) return [];

  const active = core.activeUpkeeps?.some(
    (upkeep) => upkeep.skillId === ID.FACET_OF_NATURE && upkeep.startsAt <= context.time
  );
  const legend = active ? core.activeLegendId : state.lingeringFacets?.[ID.FACET_OF_NATURE]?.legendId;
  return [
    {
      uncappedBoonDuration: legend === LEGEND.DRAGON ? 20 : 0
    }
  ];
};
