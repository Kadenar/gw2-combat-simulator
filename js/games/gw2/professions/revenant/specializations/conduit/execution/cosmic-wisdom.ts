/**
 * Owns Cosmic Wisdom activation, form selection, and activation packets.
 * Form follow-up attacks remain under `mechanics/forms.ts`.
 */
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { REVENANT_RELEASE_POTENTIAL_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileEffect as effectByType,
  balanceProfileFromContext as balanceProfileById
} from '#gw2/platform/combat/state/balance-profiles.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import {
  emitNuminousGift,
  syncConduitEnergyCostOverrides
} from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import {
  conduitFirstConditionTick as firstConditionTick,
  conduitStrikeCoefficient as strikeCoefficient
} from '#gw2/professions/revenant/specializations/conduit/execution/helpers.js';
import type { RevenantCastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Starts Cosmic Wisdom and selects the current legend-derived form. */
export function activateCosmicWisdom(context: RevenantCastContext): void {
  const state = conduitState.from(context);
  const at = context.effectiveEnd;
  // Mistfire resolves as part of the activation, before Cosmic Wisdom's
  // doubled Bolstered Bonds attributes become active.
  // It is emitted directly here rather than via observeConduitTraits because Cosmic Wisdom has no control event.
  if (hasTrait(context, TRAIT.MISTFIRE)) {
    const profile = balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.mistfire);
    const strike = effectByType(profile, 'strike');
    const burning = effectByType(profile, 'condition');
    const burningTick = firstConditionTick(burning, 'Burning');
    const mistfireSkill = { id: TRAIT.MISTFIRE, name: 'Mistfire' } as RevenantSkill;
    emitSkillDamage(context, mistfireSkill, {
      at,
      source: 'revenant',
      actorType: 'effect',
      ownerActorType: 'player',
      name: 'Mistfire',
      coefficient: strikeCoefficient(strike),
      skillWeapon: 'Unequipped',
      canCrit: null
    });
    emitSkillCondition(context, mistfireSkill, {
      at,
      source: 'revenant',
      actorType: 'effect',
      ownerActorType: 'player',
      name: 'Mistfire — Burning',
      condition: String(burningTick?.condition || 'Burning'),
      stacks: Number(burningTick?.stacks || 1),
      duration: Number(burningTick?.duration || 0)
    });
  }

  const cosmicWisdom = (context.skill.effects || []).find(
    (effect) => effect.type === 'buff' && effect.kind === 'cosmic-wisdom'
  );
  state.cosmicWisdomUntil = at + Number(cosmicWisdom?.duration || 0);
  // Derive form name from active legend; strip "Release Potential: " prefix to get "Mesmer", "Assassin", etc.
  state.conduitForm =
    REVENANT_RELEASE_POTENTIAL_BY_LEGEND[professionCoreState(context).activeLegendId]?.replace(
      'Release Potential: ',
      ''
    ) || '';
  // Energy overrides must be applied immediately so the very next skill cast sees the correct cost.
  syncConduitEnergyCostOverrides(context);
  emitRevenantStateSnapshot(context, at, 'cosmic-wisdom');
  // Numinous Gift fires on activation for the activating player (not allies); Found Purpose broadcasts to allies on swap.
  emitNuminousGift(context, context.skill);
}
