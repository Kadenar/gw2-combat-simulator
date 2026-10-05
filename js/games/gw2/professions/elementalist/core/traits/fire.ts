import { activeBuffStacks, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { MODIFIER_TARGET, powerScaledConditionAttributes } from '#gw2/platform/combat/modifiers.js';
import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';

import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import {
  combatStarted,
  elementalistProfiledBuffRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  elementalistMightStacks,
  primaryAttunement
} from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import {
  extendPersistingFlamesEffects,
  extendPersistingFlamesFields
} from '#gw2/professions/elementalist/core/traits/persisting-flames.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistModifierContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Fire definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const empoweringFlame = defineTrait({
  id: TRAIT.EMPOWERING_FLAME,
  name: 'Empowering Flame',
  balance: { attributeBonus: 150 }
});

export const inferno = defineTrait({
  id: TRAIT.INFERNO,
  name: 'Inferno',
  // Convert the intended Power rate through the canonical Burning scaling used by combat.
  balance: { coefficientMultiplier: 0.0825 / CONDITION_FORMULAS.Burning.scaling }
});

export const burningPrecision = defineTrait({
  id: TRAIT.BURNING_PRECISION,
  name: 'Burning Precision',
  balance: {
    procRate: {
      id: 'elementalist.burning-precision',
      traitId: TRAIT.BURNING_PRECISION,
      field: 'procChance',
      opportunity: 'eligible critical hit'
    },
    procChance: 0.33,
    internalCooldown: 5,
    durationMultiplier: 20,
    effects: [{ type: 'condition', name: 'Burning Precision', condition: 'Burning', stacks: 1, duration: 3 }]
  },
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Burning Duration': balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.BURNING_PRECISION),
        'durationMultiplier'
      )
    }
  })
});

export const conjurer = defineTrait({
  id: TRAIT.CONJURER,
  name: 'Conjurer',
  balance: {
    effects: [{ type: 'buff', name: 'Conjurer', kind: 'Fire Aura', stacks: 1, duration: 4 }]
  }
});

export const sunspot = defineTrait({
  id: TRAIT.SUNSPOT,
  name: 'Sunspot',
  balance: {
    effects: [
      { type: 'buff', name: 'Sunspot Aura', kind: 'Fire Aura', stacks: 1, duration: 3 },
      { type: 'strike', name: 'Sunspot', coefficient: 0.6, hits: 1 }
    ]
  }
});

export const burningRage = defineTrait({
  id: TRAIT.BURNING_RAGE,
  name: 'Burning Rage',
  balance: {
    // The replacement burning belongs to Sunspot's shared trigger.
    damagePreviewAttribution: 'shared',
    attributeBonus: 180,
    durationMultiplier: 20,
    effects: [{ type: 'condition', name: 'Sunspot Burning', condition: 'Burning', stacks: 2, duration: 4 }]
  },
  buildAttributes: traitAttributeEffects(TRAIT.BURNING_RAGE, [
    { kind: 'flat', to: 'Condition Damage', field: 'attributeBonus', feedsConversions: false }
  ])
});

export const smotheringAuras = defineTrait({
  id: TRAIT.SMOTHERING_AURAS,
  name: 'Smothering Auras',
  balance: { durationMultiplier: 1.33 }
});

export const powerOverwhelming = defineTrait({
  id: TRAIT.POWER_OVERWHELMING,
  name: 'Power Overwhelming',
  balance: {
    minimumStacks: 10,
    attributeBonus: 150,
    weaponAttributeBonus: 300
  }
});

export const pyromancersTraining = defineTrait({
  id: TRAIT.PYROMANCERS_TRAINING,
  name: "Pyromancer's Training",
  balance: {
    rechargeMultiplier: 0.8
  },
  modifierRules: [
    {
      order: -10,
      id: 'elementalist.pyromancers-training',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.07,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Burning')
    }
  ]
});

export const pyromancersPuissance = defineTrait({
  id: TRAIT.PYROMANCERS_PUISSANCE,
  name: "Pyromancer's Puissance",
  balance: {
    // Measured Fire-exit-to-impact delay, separate from the instant attunement swap.
    initialDelay: 0.68,
    maximumStacks: 10,
    damageIncreasePerStack: 0.1,
    durationPerTier: 0.5,
    effects: [
      { type: 'boon', name: 'Attunement Might', boon: 'might', stacks: 1, duration: 15 },
      { type: 'boon', name: 'Flame Expulsion Might', boon: 'might', stacks: 1, duration: 15 },
      { type: 'strike', name: 'Flame Expulsion', coefficient: 1, hits: 1 },
      { type: 'condition', name: 'Flame Expulsion', condition: 'Burning', stacks: 1, duration: 2 }
    ]
  }
});

/** Own field extensions, stack lifetime, and damage tuning while keeping ordered resolver calls explicit. */
export const persistingFlames = defineTrait({
  id: TRAIT.PERSISTING_FLAMES,
  name: 'Persisting Flames',
  balance: { durationMultiplier: 15, durationPerTier: 2, summons: 2, maximumStacks: 5 },
  modifierRules: [
    {
      id: 'elementalist.persisting-flames',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      order: -11,
      parameters: { damagePerStack: 0.02 },
      amount: (context, _target, parameters) =>
        activeBuffStacks(
          context,
          'persisting flames',
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PERSISTING_FLAMES), 'maximumStacks')
        ) * parameters.damagePerStack
    }
  ],
  hooks: {
    modifyEffects: (runtime: ElementalistRuntime, cast, effects) =>
      extendPersistingFlamesEffects(runtime, cast.skill, effects),
    modifyComboFields: extendPersistingFlamesFields
  }
});

/** Grants Pyromancer's Puissance might after an in-combat Fire-attuned cast. */
export function applyPyromancersPuissance(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const at = cast.effectiveEnd;
  if (
    !hasTrait(context, TRAIT.PYROMANCERS_PUISSANCE) ||
    professionCoreState(context).primaryAttunement !== 'Fire' ||
    !combatStarted(context, at)
  )
    return;
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      at,
      TRAIT.PYROMANCERS_PUISSANCE,
      'Attunement Might',
      skill.name,
      skill.id,
      undefined,
      undefined,
      { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    )
  );
}

/** Applies Smothering Auras' profile-driven duration multiplier once. */
export function elementalistAuraDuration(context: unknown, duration: number): number {
  return hasTrait(context, TRAIT.SMOTHERING_AURAS)
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SMOTHERING_AURAS), 'durationMultiplier')
    : duration;
}

/** Conjurer grants its aura between bundle creation and the resulting swap events. */
export function applyConjurerAura(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  applyAura: ElementalistAuraApplier
): void {
  const at = cast.effectiveEnd;
  if (hasTrait(context, TRAIT.CONJURER)) {
    const conjurerProfile = requireBalanceProfileFromContext(context, TRAIT.CONJURER);
    const conjurerBuff = requireEffect(conjurerProfile, 'buff', 'Conjurer');
    if (conjurerBuff) {
      applyAura(context, {
        at,
        aura: String(conjurerBuff.kind),
        duration: conjurerBuff.duration,
        skillName: 'Conjurer',
        sourceId: skill.id
      });
    }
  }
}

/** Preserve the live fire attribute pass at its original position in the Core modifier pipeline. */
export function applyFireTraitAttributes(context: ElementalistModifierContext, modified: Gw2MutableStats): void {
  const primary = primaryAttunement(context);
  if (hasTrait(context, TRAIT.EMPOWERING_FLAME) && primary === 'Fire') {
    const empoweringFlameProfile = requireBalanceProfileFromContext(context, TRAIT.EMPOWERING_FLAME);
    modified.power = (modified.power || 0) + balanceProfileNumber(empoweringFlameProfile, 'attributeBonus');
  }

  if (
    hasTrait(context, TRAIT.POWER_OVERWHELMING) &&
    elementalistMightStacks(context) >=
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.POWER_OVERWHELMING), 'minimumStacks')
  ) {
    const powerOverwhelmingProfile = requireBalanceProfileFromContext(context, TRAIT.POWER_OVERWHELMING);
    modified.power =
      (modified.power || 0) +
      (primary === 'Fire'
        ? balanceProfileNumber(powerOverwhelmingProfile, 'weaponAttributeBonus')
        : balanceProfileNumber(powerOverwhelmingProfile, 'attributeBonus'));
  }
}

/** Inferno converts final Power only for its Burning packets at condition-attribute evaluation. */
export function applyInfernoAttributes(context: ElementalistModifierContext, attributes: Gw2Stats): Gw2Stats {
  return powerScaledConditionAttributes(context, attributes, 'Burning', TRAIT.INFERNO);
}

/** Scale this element's weapon recharge after the mechanic has handled held and non-weapon cooldowns. */
export function pyromancersTrainingRecharge(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  duration: number
): number {
  return skill.attunement === 'Fire' && hasTrait(context, TRAIT.PYROMANCERS_TRAINING)
    ? duration *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.PYROMANCERS_TRAINING),
          'rechargeMultiplier'
        )
    : duration;
}
