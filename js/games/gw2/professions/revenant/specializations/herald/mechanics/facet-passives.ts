import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { HERALD_DRACONIC_ECHO_PROFILE_ID } from '#gw2/professions/revenant/specializations/herald/profiles.js';

/** Active upkeep and retained passives share eligibility, but only upkeep drains Energy. */
export function heraldFacetPassiveActive(
  core: Partial<RevenantCoreState>,
  state: Partial<HeraldState>,
  skillId: SkillId,
  at: number
): boolean {
  const lingering = state.lingeringFacets?.[skillId];
  return Boolean(
    core.activeUpkeeps?.some((upkeep) => upkeep.skillId === skillId && (upkeep.startsAt || 0) <= at) ||
    (lingering && lingering.startsAt <= at && at < lingering.expiresAt)
  );
}

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

/** Supplies the capped Echo boon-duration contribution for active Nature. */
function draconicEchoBoonDuration(context: Gw2ModifierContext): number {
  return hasTrait(context, TRAIT.DRACONIC_ECHO)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID),
        'boonDurationBonus'
      )
    : 0;
}
