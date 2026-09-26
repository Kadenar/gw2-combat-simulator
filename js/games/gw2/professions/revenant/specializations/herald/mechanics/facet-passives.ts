import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
  REVENANT_LEGEND_IDS as LEGEND
} from '#gw2/professions/revenant/data/ids.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/traits/modifiers.js';
import { HERALD_DRACONIC_ECHO_PROFILE_ID } from '#gw2/professions/revenant/specializations/herald/profiles.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';

/** Active upkeep and retained passives share eligibility, but only upkeep drains Energy. */
export function heraldFacetPassiveActive(
  core: Partial<RevenantCoreState>,
  state: Partial<HeraldState>,
  skillId: SkillId,
  at: number
): boolean {
  const lingering = state.lingeringFacets?.[skillId];
  return Boolean(
    core.activeUpkeeps?.some((upkeep) => upkeep.skillId === skillId && Number(upkeep.startsAt || 0) <= at) ||
    (lingering && lingering.startsAt <= at && at < lingering.expiresAt)
  );
}

function draconicEchoActive(context: Gw2ModifierContext, skillId: SkillId): boolean {
  return (
    hasTrait(context, TRAIT.DRACONIC_ECHO) &&
    heraldFacetPassiveActive(
      revenantRuntimeCoreState(context),
      revenantRuntimeSpecializationState(context, 'Herald'),
      skillId,
      context.time
    )
  );
}

// Only outgoing damage and boon attributes have simulator consumers; defensive/healing values stay in the profile.
export const heraldPassiveModifierRules: readonly Gw2ModifierRule[] = [
  {
    id: 'revenant.draconic-echo-strength',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: (context) =>
      1 +
      balanceProfileNumber(requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID), 'damageBonus'),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_STRENGTH)
  },
  {
    id: 'revenant.draconic-echo-elements',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: (context) =>
      1 +
      balanceProfileNumber(requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID), 'damageBonus'),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_ELEMENTS)
  },
  {
    id: 'revenant.draconic-echo-darkness',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID),
        'criticalChanceBonus'
      ),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_DARKNESS)
  }
];

/** Dragon Nature adds duration after the normal cap without changing Concentration; Echo stays capped. */
export function modifyHeraldPassiveAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const core = revenantRuntimeCoreState(context);
  const state = revenantRuntimeSpecializationState(context, 'Herald') as Partial<HeraldState>;
  if (!heraldFacetPassiveActive(core, state, ID.FACET_OF_NATURE, context.time)) return attributes;
  const active = core.activeUpkeeps?.some(
    (upkeep) => upkeep.skillId === ID.FACET_OF_NATURE && Number(upkeep.startsAt || 0) <= context.time
  );
  const legend = active ? core.activeLegendId : state.lingeringFacets?.[ID.FACET_OF_NATURE]?.legendId;
  return {
    ...attributes,
    uncappedBoonDurationBonus: Number(attributes.uncappedBoonDurationBonus || 0) + (legend === LEGEND.DRAGON ? 20 : 0),
    boonDurationBonus:
      Number(attributes.boonDurationBonus || 0) +
      (hasTrait(context, TRAIT.DRACONIC_ECHO)
        ? balanceProfileNumber(
            requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID),
            'boonDurationBonus'
          )
        : 0)
  };
}
