import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

import {
  cloneNecromancerAttributes,
  necromancerRuntimeSpecializationState
} from '#gw2/professions/necromancer/core/modifiers.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';

/** Applies Harbinger vitality and vitality-derived conversions when the build layer has not. */
function modifyHarbingerAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  if (!professionStaticRulesApplied(context.config)) {
    // Alchemic Vigor is the minor adept trait; the specialization check lets it apply even when only the
    // spec is selected without the trait being explicitly listed (e.g. from the specialization line bonus).
    if (context.config?.specialization === 'Harbinger' || hasTrait(context, TRAIT.ALCHEMIC_VIGOR)) {
      const alchemicVigorProfile = requireBalanceProfileFromContext(context, PROFILE.alchemicVigor);
      result.vitality += balanceProfileNumber(alchemicVigorProfile, 'attributeBonus');
    }

    if (hasTrait(context, TRAIT.IMPLACABLE_FOE)) {
      const implacableFoeProfile = requireBalanceProfileFromContext(context, PROFILE.implacableFoe);
      result.ferocity += result.vitality * balanceProfileNumber(implacableFoeProfile, 'attributeConversion');
    }

    if (hasTrait(context, TRAIT.TWISTED_MEDICINE)) {
      const twistedMedicineProfile = requireBalanceProfileFromContext(context, PROFILE.twistedMedicine);
      result.concentration += result.vitality * balanceProfileNumber(twistedMedicineProfile, 'attributeConversion');
    }

    if (hasTrait(context, TRAIT.DARK_GUNSLINGER)) {
      const darkGunslingerProfile = requireBalanceProfileFromContext(context, PROFILE.darkGunslinger);
      // Alchemic Vigor and other flat Vitality bonuses precede conversion.
      result.expertise += Math.round(
        result.vitality * balanceProfileNumber(darkGunslingerProfile, 'attributeConversion')
      );
    }
  }

  return result;
}

/** Reads event-snapshotted Blight before falling back to current Harbinger runtime state. */
function activeBlight(context: Gw2ModifierContext): number {
  const event = context.event;
  // Prefer the snapshotted blight from the event so that modifier rules see the value at the moment of impact,
  // not the current (post-impact) blight count which may already be lower due to subsequent consumption.
  return Math.max(
    0,
    Number(
      event?.metadata?.necromancerBlight ?? necromancerRuntimeSpecializationState(context, 'Harbinger').blight ?? 0
    )
  );
}

const harbingerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'necromancer.wicked-corruption-blight',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: { damagePerStack: 0.01 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => activeBlight(context) * parameters.damagePerStack,
    when: (context) => hasTrait(context, TRAIT.WICKED_CORRUPTION)
  },
  {
    id: 'necromancer.wicked-corruption-critical-hit-damage',
    // Multiplying critical damage directly also composes with Death Perception exactly once.
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',

    factor: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.WICKED_CORRUPTION), 'criticalDamage'),
    order: 100,
    when: (context) => hasTrait(context, TRAIT.WICKED_CORRUPTION) && targetConditionActive(context, 'Torment')
  },
  {
    id: 'necromancer.septic-corruption-blight',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    parameters: { damagePerStack: 0.0025 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => activeBlight(context) * parameters.damagePerStack,
    when: (context) => hasTrait(context, TRAIT.SEPTIC_CORRUPTION)
  },
  {
    id: 'necromancer.cascading-corruption',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    // 10% bonus applies only during the 10 s Meltdown window; meltdownUntil is set/cleared in applyCascadingCorruption.
    when: (context) =>
      hasTrait(context, TRAIT.CASCADING_CORRUPTION) &&
      Number(necromancerRuntimeSpecializationState(context, 'Harbinger').meltdownUntil || 0) > context.time
  }
]);

export const harbingerModifiers = Object.freeze({
  modifyAttributes: modifyHarbingerAttributes,
  modifierRules: harbingerModifierRules
});
