import { attributeProvenance } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, countActiveBoons } from '#gw2/platform/combat/query/runtime-query.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';

/** Owns Permeating Wrath tuning and behavior at its existing mechanic boundaries. */
export const permeatingWrath = defineTrait({
  id: GUARDIAN_TRAIT_IDS.PERMEATING_WRATH,
  name: 'Permeating Wrath',
  balance: { threshold: 3 }
});

/** Owns Inspired Virtue tuning and behavior at its existing mechanic boundaries. */
export const inspiredVirtue = defineTrait({
  id: GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
  name: 'Inspired Virtue',
  balance: {
    effects: [
      { type: 'boon', name: 'might', boon: 'might', stacks: 3, duration: 5 },
      { type: 'boon', name: 'regeneration', boon: 'regeneration', stacks: 1, duration: 5 },
      { type: 'boon', name: 'protection', boon: 'protection', stacks: 1, duration: 5 }
    ]
  },
  modifierRules: [
    {
      order: -13,
      id: 'guardian.inspired-virtue',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // Boon bonuses sum within this trait, then multiply the outgoing additive bucket.
      operation: 'multiply',
      parameters: { damagePerBoon: 0.005 },
      factor: (context, _target, parameters) =>
        1 +
        countActiveBoons(context, { actor: 'player' }, (boon) => guardianBoonActive(context, boon)) *
          parameters.damagePerBoon
    }
  ]
});

/** Owns Virtue of Resolution tuning and behavior at its existing mechanic boundaries. */
export const virtueOfResolution = defineTrait({
  id: GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
  name: 'Virtue of Resolution',
  balance: {
    durationMultiplier: 1.25,
    effects: [{ type: 'boon', name: 'resolution', boon: 'resolution', stacks: 1, duration: 3 }]
  }
});

/** Owns Inspiring Virtue tuning and behavior at its existing mechanic boundaries. */
export const inspiringVirtue = defineTrait({
  id: GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE,
  name: 'Inspiring Virtue',
  balance: {
    effects: [
      {
        type: 'buff',
        name: 'guardian-inspiring-virtue',
        kind: 'guardian-inspiring-virtue',
        stacks: 1,
        duration: 6
      }
    ]
  },
  modifierRules: [
    {
      order: -10,
      id: 'guardian.inspiring-virtue',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => buffActive(context, 'guardian-inspiring-virtue')
    }
  ]
});

/** Owns Indomitable Courage tuning and behavior at its existing mechanic boundaries. */
export const indomitableCourage = defineTrait({
  id: GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE,
  name: 'Indomitable Courage',
  balance: {
    pulseInterval: 30,
    effects: [{ type: 'boon', name: 'stability', boon: 'stability', stacks: 3, duration: 4 }]
  }
});

/** Owns Master of Consecrations tuning and behavior at its existing mechanic boundaries. */
export const masterOfConsecrations = defineTrait({
  id: GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS,
  name: 'Master of Consecrations',
  balance: {
    // Extra Purging Flames pulses extend the authored skill rather than creating a standalone proc.
    damagePreviewAttribution: 'skill',
    durationMultiplier: 1.4,
    // Extend Purging Flames after its six base pulses, with independent cast-start timelines for each effect.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Strike',
        ticks: [6320, 7320].map((atMs) => ({ atMs, coefficient: 0.2 })),
        actorType: 'player'
      },
      {
        type: 'condition',
        name: 'Burning',
        ticks: [6320, 7320].map((atMs) => ({ atMs, condition: 'Burning', stacks: 1, duration: 2 })),
        actorType: 'player'
      }
    ])
  }
});

/** Owns Power of the Virtuous tuning and behavior at its existing mechanic boundaries. */
export const powerOfTheVirtuous = defineTrait({
  id: GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS,
  name: 'Power of the Virtuous',
  balance: {
    attributeConversion: 0.07,
    rechargeMultiplier: 0.85
  },
  modifierRules: [
    {
      order: -16,
      id: 'guardian.power-of-the-virtuous-condition-damage',
      label: 'Power of the Virtuous',
      target: MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
      operation: 'add',
      amount: (context) =>
        attributeProvenance(context.config).professionStaticRulesApplied
          ? 0
          : (context.config?.stats?.vitality || 0) *
            balanceProfileNumber(
              requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS),
              'attributeConversion'
            )
    }
  ],
  buildAttributes: traitAttributeEffects(GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS, [
    {
      kind: 'conversion',
      from: 'Vitality',
      to: 'Condition Damage',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'eligible'
    }
  ])
});

/** Owns Unscathed Contender tuning and behavior at its existing mechanic boundaries. */
export const unscathedContender = defineTrait({
  id: GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER,
  name: 'Unscathed Contender',
  modifierRules: [
    {
      order: -12,
      id: 'guardian.unscathed-contender-health',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // The assumed above-90% health bonus multiplies damage; the Aegis bonus stays additive.
      operation: 'multiply',
      factor: 1.05
    },
    {
      order: -11,
      id: 'guardian.unscathed-contender-aegis',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.05,
      when: (context) => guardianBoonActive(context, 'aegis')
    }
  ]
});

/** Owns Glacial Heart tuning and behavior at its existing mechanic boundaries. */
export const glacialHeart = defineTrait({ id: GUARDIAN_TRAIT_IDS.GLACIAL_HEART, name: 'Glacial Heart' });

export const battlePresence = defineTrait({ id: GUARDIAN_TRAIT_IDS.BATTLE_PRESENCE, name: 'Battle Presence' });
