import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { targetConditionStacks as configuredTargetConditionStacks } from '#gw2/platform/combat/state/targets.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

import {
  cloneNecromancerAttributes,
  necromancerActiveShroud,
  necromancerEventSkill,
  necromancerTargetChilled
} from '#gw2/professions/necromancer/core/traits/modifiers.js';
import { REAPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/reaper/profiles.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

/** Applies Reaper's Onslaught ferocity while Reaper Shroud is active. */
function modifyReaperAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  if (hasTrait(context, TRAIT.REAPERS_ONSLAUGHT) && necromancerActiveShroud(context) === 'reaper') {
    const reapersOnslaughtProfile = requireBalanceProfileFromContext(context, PROFILE.reapersOnslaught);
    result.ferocity += balanceProfileNumber(reapersOnslaughtProfile, 'attributeBonus');
  }

  return result;
}

export const reaperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    // Reaper Shouts deal double damage to nearby targets (the sole target is assumed nearby unless explicitly set false).
    id: 'necromancer.reaper-shout-melee',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    // order: 100 places this after additive damage buckets so it multiplies the already-summed base.
    order: 100,
    when: (context) =>
      Boolean(
        // Shout doubling belongs to the player's skill packet, not merely an effect that inherits player modifiers.
        isGw2PlayerActorEvent(context.event) &&
        necromancerEventSkill(context)?.categories?.includes('Shout') &&
        context.config?.target?.nearby !== false
      )
  },
  {
    id: 'necromancer.decimate-defenses',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    // Each stack of Vulnerability adds 2% crit chance, capped at 25 stacks (50% max bonus).
    // Falls back to configured static stacks when a live query runtime isn't available.

    amount: (context) => {
      const decimateDefensesProfile = requireBalanceProfileFromContext(context, TRAIT.DECIMATE_DEFENSES);
      return (
        Math.min(
          balanceProfileNumber(decimateDefensesProfile, 'maximumStacks'),
          Number(
            context.query?.targetConditionStacks
              ? context.query.targetConditionStacks('Vulnerability', context.time, context.runtime)
              : configuredTargetConditionStacks(context.config || {}, 'Vulnerability', context.time, context.runtime)
          )
        ) * balanceProfileNumber(decimateDefensesProfile, 'criticalChancePerStack')
      );
    },
    when: (context) => hasTrait(context, TRAIT.DECIMATE_DEFENSES)
  },
  {
    id: 'necromancer.cold-shoulder',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.COLD_SHOULDER) && necromancerTargetChilled(context)
  },
  {
    id: 'necromancer.soul-eater',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.SOUL_EATER) && context.config?.target?.nearby !== false
  }
]);

export const reaperAttributeRules = Object.freeze({
  modifyAttributes: modifyReaperAttributes,
  modifierRules: reaperModifierRules
});
