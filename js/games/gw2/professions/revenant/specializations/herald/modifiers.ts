import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { heraldFacetPassiveActive } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { draconicEchoBoonDuration } from '#gw2/professions/revenant/specializations/herald/traits/index.js';

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
  modifierRules: heraldModifierRules,
  modifyAttributes: modifyHeraldPassiveAttributes
});

/** Dragon Nature adds duration after the normal cap without changing Concentration; Echo stays capped. */
export function modifyHeraldPassiveAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const core = revenantRuntimeCoreState(context);
  const state = revenantRuntimeSpecializationState(context, 'Herald') as Partial<HeraldState>;
  if (!heraldFacetPassiveActive(core, state, ID.FACET_OF_NATURE, context.time)) return attributes;
  const active = core.activeUpkeeps?.some(
    (upkeep) => upkeep.skillId === ID.FACET_OF_NATURE && (upkeep.startsAt || 0) <= context.time
  );
  const legend = active ? core.activeLegendId : state.lingeringFacets?.[ID.FACET_OF_NATURE]?.legendId;
  return {
    ...attributes,
    uncappedBoonDurationBonus: (attributes.uncappedBoonDurationBonus || 0) + (legend === LEGEND.DRAGON ? 20 : 0),
    boonDurationBonus: (attributes.boonDurationBonus || 0) + draconicEchoBoonDuration(context)
  };
}
