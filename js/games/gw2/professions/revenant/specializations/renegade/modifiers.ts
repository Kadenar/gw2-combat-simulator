import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { boonActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/modifiers.js';
import { activeKallasFervorStacks } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';

function kallasFervorStacks(context: Gw2ModifierContext): number {
  return activeKallasFervorStacks(revenantRuntimeSpecializationState(context, 'Renegade'), context.time);
}

export const renegadeModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.heartpiercer-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.HEARTPIERCER) &&
      targetConditionActive(context, 'Bleeding')
  },
  {
    id: 'revenant.heartpiercer-bleeding',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      context.condition === 'Bleeding' &&
      hasTrait(context, TRAIT.HEARTPIERCER)
  },
  {
    id: 'revenant.kallas-fervor-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      damagePerStack: 0.02,
      improvedDamagePerStack: 0.05
    },
    amount: (context, _target, parameters) => {
      const perStack = hasTrait(context, TRAIT.LASTING_LEGACY)
        ? parameters.improvedDamagePerStack
        : parameters.damagePerStack;
      return kallasFervorStacks(context) * perStack;
    },
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && kallasFervorStacks(context) > 0
  },
  {
    id: 'revenant.kallas-fervor-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      damagePerStack: 0.02,
      improvedDamagePerStack: 0.03
    },
    amount: (context, _target, parameters) => {
      const perStack = hasTrait(context, TRAIT.LASTING_LEGACY)
        ? parameters.improvedDamagePerStack
        : parameters.damagePerStack;
      return kallasFervorStacks(context) * perStack;
    },
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && kallasFervorStacks(context) > 0
  },
  {
    id: 'revenant.blood-fury-bleeding-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, RENEGADE_PROFILE_IDS.bloodFury),
        'conditionDurationBonus'
      ),
    // Blood Fury shares the chronological player-Fury query used by Core Revenant modifiers.
    when: (context) =>
      context.condition === 'Bleeding' && hasTrait(context, TRAIT.BLOOD_FURY) && boonActive(context, 'fury')
  }
]);

function modifyRenegadeCriticalChance(context: Gw2ModifierContext, chance: number): number {
  if (!hasTrait(context, TRAIT.BRUTAL_MOMENTUM)) return chance;
  const state = revenantRuntimeCoreState(context);
  const maximum = REVENANT_MAXIMUM_ENDURANCE;
  // 1e-9 tolerance handles floating-point endurance values that should be exactly at cap
  const full = maximum > 0 && Number(state.endurance || 0) >= maximum - 1e-9;
  const brutalMomentumProfile = requireBalanceProfileFromContext(context, RENEGADE_PROFILE_IDS.brutalMomentum);
  // At full endurance: +33% crit; below full: +10% crit
  return chance + balanceProfileNumber(brutalMomentumProfile, full ? 'fullEnduranceCriticalChance' : 'criticalChance');
}

export const renegadeModifiers = Object.freeze({
  modifierRules: renegadeModifierRules,
  modifyCriticalChance: modifyRenegadeCriticalChance
});
