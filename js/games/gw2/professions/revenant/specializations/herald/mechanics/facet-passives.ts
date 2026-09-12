import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import {
  balanceProfileFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { Gw2Stats } from '#gw2/platform/equipment/types.js';
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
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import {
  HERALD_DRACONIC_ECHO_PROFILE_ID,
  HERALD_NATURE_ASSASSIN_PROFILE_ID
} from '#gw2/professions/revenant/specializations/herald/profiles.js';
import type {
  HeraldState,
  RevenantCoreState,
  RevenantResolverContext,
  RevenantResolverEvent
} from '#gw2/professions/revenant/types.js';

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
      1 + balanceProfileValueFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID, 'damageBonus', 0.1),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_STRENGTH)
  },
  {
    id: 'revenant.draconic-echo-elements',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: (context) =>
      1 + balanceProfileValueFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID, 'damageBonus', 0.1),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_ELEMENTS)
  },
  {
    id: 'revenant.draconic-echo-darkness',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileValueFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID, 'criticalChanceBonus', 0.1),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_DARKNESS)
  }
];

/** Nature's Draconic Echo bonus enters ordinary boon-duration scaling and its normal cap. */
export function modifyHeraldPassiveAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  if (!draconicEchoActive(context, ID.FACET_OF_NATURE)) return attributes;
  return {
    ...attributes,
    boonDurationBonus:
      Number(attributes.boonDurationBonus || 0) +
      balanceProfileValueFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID, 'boonDurationBonus', 10)
  };
}

/** Only resolved player strikes trigger Assassin Nature; effect-owned siphons cannot recurse. */
export function resolveNatureSiphon(context: RevenantResolverContext, event: RevenantResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || event.cancelled) return;
  const core = professionCoreState(context);
  const state = heraldState.from(context);
  const active = core.activeUpkeeps.some(
    (upkeep) => upkeep.skillId === ID.FACET_OF_NATURE && Number(upkeep.startsAt || 0) <= event.at
  );
  const legend = active ? core.activeLegendId : state.lingeringFacets[ID.FACET_OF_NATURE]?.legendId;
  if (
    legend !== LEGEND.ASSASSIN ||
    !heraldFacetPassiveActive(core, state, ID.FACET_OF_NATURE, event.at) ||
    !isInternalCooldownReady(event.at, state.natureSiphonReadyAt)
  )
    return;
  const profile = balanceProfileFromContext(context, HERALD_NATURE_ASSASSIN_PROFILE_ID);
  const strike = profile?.effects?.find((effect) => effect.type === 'strike');
  if (!profile || !strike) throw new Error('Missing Assassin Facet of Nature passive profile.');
  state.natureSiphonReadyAt = event.at + Number(profile.cooldown);
  context.queue.enqueue({
    type: 'damage',
    at: event.at,
    source: 'revenant',
    sourceId: ID.FACET_OF_NATURE,
    skillId: ID.FACET_OF_NATURE,
    skillName: profile.name,
    name: 'Facet of Nature — Life Siphon',
    actorType: 'effect',
    ownerActorType: 'player',
    coefficient: 0,
    hits: 1,
    noCrit: true,
    lifeSiphon: true,
    flatStrikeBase: Number(strike.flatStrikeBase),
    flatStrikePowerCoeff: Number(strike.flatStrikePowerCoeff),
    skillWeapon: 'Unequipped',
    triggeredBy: event.skillName
  });
}
