/**
 * Owns Cosmic Wisdom activation, form selection, and activation packets.
 * Form follow-up attacks remain under `mechanics/forms.ts`.
 */
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/family-state.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { REVENANT_CONDUIT_FORM_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import {
  emitNuminousGift,
  syncConduitEnergyCostOverrides
} from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import { strikeEffectCoefficient } from '#gw2/platform/engine/effects/authoring.js';
import type { RevenantCastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Starts Cosmic Wisdom and selects the current legend-derived form. */
export function activateCosmicWisdom(context: RevenantCastContext): void {
  const state = conduitState.from(context);
  const at = context.effectiveEnd;
  // Mistfire resolves as part of the activation, before Cosmic Wisdom's
  // doubled Bolstered Bonds attributes become active.
  // It is emitted directly here rather than via observeConduitTraits because Cosmic Wisdom has no control event.
  if (hasTrait(context, TRAIT.MISTFIRE)) {
    const profile = requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.mistfire);
    // The activation strike and Burning are independent packets; either survives the other's removal.
    const strike = requireEffect(profile, 'strike', 'Mistfire');
    const burning = requireEffect(profile, 'condition', 'Burning');
    const mistfireSkill = { id: TRAIT.MISTFIRE, name: 'Mistfire' } as RevenantSkill;
    if (strike)
      emitSkillDamage(context, mistfireSkill, {
        at,
        source: 'revenant',
        actorType: 'effect',
        ownerActorType: 'player',
        name: 'Mistfire',
        coefficient: strikeEffectCoefficient(strike),
        skillWeapon: 'Unequipped',
        canCrit: null
      });
    if (burning)
      emitSkillCondition(context, {
        skill: mistfireSkill,
        at,
        actorType: 'effect',
        ownerActorType: 'player',
        name: 'Mistfire — Burning',
        condition: String(burning.condition),
        stacks: effectNumber(profile, burning, 'stacks'),
        duration: effectNumber(profile, burning, 'duration')
      });
  }

  const cosmicWisdom = requireEffect(context.skill, 'buff', 'cosmic-wisdom');
  // A removed window buff leaves Cosmic Wisdom's form and gift active for no duration.
  state.cosmicWisdomUntil = at + (cosmicWisdom ? effectNumber(context.skill, cosmicWisdom, 'duration') : 0);
  // Select the mechanic form directly from legend identity, independent of display labels.
  state.conduitForm = REVENANT_CONDUIT_FORM_BY_LEGEND[professionCoreState(context).activeLegendId] || '';
  // Energy overrides must be applied immediately so the very next skill cast sees the correct cost.
  syncConduitEnergyCostOverrides(context);
  emitRevenantStateSnapshot(context, at, 'cosmic-wisdom');
  // Numinous Gift fires on activation for the activating player (not allies); Found Purpose broadcasts to allies on swap.
  emitNuminousGift(context, context.skill);
}
