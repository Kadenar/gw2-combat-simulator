import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { heraldFacetPassiveActive } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';

const heraldModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.burst-of-strength-strike',
    order: 101,
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // "burst-of-strength" is a timed buff key written by the skill handler, not a boon; it uses buffActive rather than boon tracking.
    amount: 0.1,
    when: (context) => buffActive(context, 'burst-of-strength')
  },
  {
    id: 'revenant.burst-of-strength-condition',
    order: 102,
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => buffActive(context, 'burst-of-strength')
  }
]);

export const heraldModifiers = Object.freeze({
  modifierRules: heraldModifierRules
});

/** Dragon Nature adds duration after the normal cap without changing Concentration; Echo stays capped. */
export const heraldAttributes: Gw2AttributeContributionCalculator = (context) => {
  const core = revenantRuntimeCoreState(context);
  const state = revenantRuntimeSpecializationState(context, 'Herald') as Partial<HeraldState>;
  if (!heraldFacetPassiveActive(core, state, ID.FACET_OF_NATURE, context.time)) return [];
  const active = core.activeUpkeeps?.some(
    (upkeep) => upkeep.skillId === ID.FACET_OF_NATURE && (upkeep.startsAt || 0) <= context.time
  );
  const legend = active ? core.activeLegendId : state.lingeringFacets?.[ID.FACET_OF_NATURE]?.legendId;
  return [
    {
      uncappedBoonDuration: legend === LEGEND.DRAGON ? 20 : 0
    }
  ];
};
