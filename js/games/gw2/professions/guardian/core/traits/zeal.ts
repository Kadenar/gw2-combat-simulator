import { attributeProvenance } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { activeWeapon, guardianRuntimeState } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { activeSymbolicAvengerExpirations } from '#gw2/professions/guardian/core/state.js';
import { isGuardianSymbolSkill } from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Owns Furious Focus's live tuning and trait behavior. */
export const furiousFocus = defineTrait({
  id: TRAIT.FURIOUS_FOCUS,
  name: 'Furious Focus',
  balance: {
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        name: 'Strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: index * 1000, coefficient: 3.25 / 5 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  modifierRules: [
    {
      order: -6,
      id: 'guardian.furious-focus',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
    }
  ]
});

/** Owns Symbolic Exposure's live tuning and trait behavior. */
export const symbolicExposure = defineTrait({
  id: TRAIT.SYMBOLIC_EXPOSURE,
  name: 'Symbolic Exposure',
  balance: {
    effects: [
      {
        type: 'condition',
        name: 'Vulnerability',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 5,
        actorType: 'effect'
      }
    ]
  },
  modifierRules: [
    {
      id: 'guardian.symbolic-exposure',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.05,
      order: 100,
      when: (context) => targetConditionActive(context, 'Vulnerability')
    }
  ],
  triggers: [
    {
      order: -1,
      emit: TRAIT.SYMBOLIC_EXPOSURE,
      on: 'damage.resolved',
      when: (runtime, event, details) =>
        event.actorType === 'player' &&
        Number(event.coefficient) > 0 &&
        (details.hitContext?.damage ?? 0) > 0 &&
        Boolean(
          event.isSymbol ||
          isGuardianSymbolSkill(
            event.skillId == null ? undefined : runtime.helpers.skillsById.get(event.skillId),
            event.skillName
          )
        ),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Vulnerability',
      attribution: {
        source: 'guardian',
        skillId: TRAIT.SYMBOLIC_EXPOSURE,
        skillName: 'Symbolic Exposure',
        name: 'Symbolic Exposure \u2014 Vulnerability',
        priority: 5
      }
    }
  ]
});

/** Owns Symbolic Avenger's live tuning and trait behavior. */
export const symbolicAvenger = defineTrait({
  id: TRAIT.SYMBOLIC_AVENGER,
  name: 'Symbolic Avenger',
  balance: { maximumStacks: 5, pulseInterval: 15 },
  modifierRules: [
    {
      order: -5,
      id: 'guardian.symbolic-avenger',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      parameters: {
        maximumStacks: 5,
        damagePerStack: 0.01
      },
      amount: (context, _target, parameters) =>
        Math.min(
          parameters.maximumStacks,
          activeSymbolicAvengerExpirations(guardianRuntimeState(context), context.time).length
        ) * parameters.damagePerStack
    }
  ]
});

/** Owns Zealot's Resolution's live tuning and trait behavior. */
export const zealotsResolution = defineTrait({
  id: TRAIT.ZEALOTS_RESOLUTION,
  name: "Zealot's Resolution",
  balance: {
    cooldown: 30,
    threshold: 0.25,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: index * 1000, coefficient: 2.5 / 5 })),
        actorType: 'player'
      },
      {
        type: 'boon',
        name: 'resolution',
        boon: 'resolution',
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000,
        actorType: 'player'
      }
    ])
  }
});

/** Owns Zealous Blade's live tuning and trait behavior. */
export const zealousBlade = defineTrait({
  id: TRAIT.ZEALOUS_BLADE,
  name: 'Zealous Blade',
  balance: {
    weaponAttributeBonus: 240,
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  },
  modifierRules: [
    {
      order: -20,
      id: 'guardian.zealous-blade-power',
      label: 'Zealous Blade',
      target: MODIFIER_TARGET.ATTRIBUTE_POWER,
      operation: 'add',
      amount: (context) => {
        const provenance = attributeProvenance(context.config);
        const currentWeapon = activeWeapon(context);
        const zealousBladeProfile = requireBalanceProfileFromContext(context, TRAIT.ZEALOUS_BLADE);
        return provenance.professionStaticRulesApplied
          ? (Number(currentWeapon === 'Greatsword') - Number(provenance.calculatedPrimaryWeapon === 'Greatsword')) *
              (balanceProfileNumber(zealousBladeProfile, 'weaponAttributeBonus') -
                balanceProfileNumber(zealousBladeProfile, 'attributeBonus'))
          : balanceProfileNumber(zealousBladeProfile, 'attributeBonus') +
              Number(currentWeapon === 'Greatsword') *
                (balanceProfileNumber(zealousBladeProfile, 'weaponAttributeBonus') -
                  balanceProfileNumber(zealousBladeProfile, 'attributeBonus'));
      }
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext, build, weaponSet }) => {
    const zealousBladeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ZEALOUS_BLADE);
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    const mainHand = weapons[0] || '';
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(
            zealousBladeProfile,
            mainHand === 'Greatsword' ? 'weaponAttributeBonus' : 'attributeBonus'
          ),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Kindled Zeal's live tuning and trait behavior. */
export const kindledZeal = defineTrait({
  id: TRAIT.KINDLED_ZEAL,
  name: 'Kindled Zeal',
  balance: { attributeConversion: 0.1 },
  buildAttributes: traitAttributeEffects(TRAIT.KINDLED_ZEAL, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Condition Damage',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'eligible'
    }
  ])
});

/** Owns Eternal Armory's live tuning and trait behavior. */
export const eternalArmory = defineTrait({
  id: TRAIT.ETERNAL_ARMORY,
  name: 'Eternal Armory',
  balance: {
    resourceGain: 1
  }
});

/** Owns Fiery Wrath's live tuning and trait behavior. */
export const fieryWrath = defineTrait({
  id: TRAIT.FIERY_WRATH,
  name: 'Fiery Wrath',
  modifierRules: [
    {
      id: 'guardian.fiery-wrath',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.05,
      order: 100,
      when: (context) => targetConditionActive(context, 'Burning')
    }
  ]
});

export const guardianZealTraits = [
  fieryWrath,
  furiousFocus,
  symbolicExposure,
  symbolicAvenger,
  zealotsResolution,
  zealousBlade,
  kindledZeal,
  eternalArmory
];
