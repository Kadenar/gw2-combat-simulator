import { ACTOR, WEAPON, CONDITION } from '#gw2/platform/constants.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';

import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  attributeBonusNumber,
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { guardianStruck, type GuardianStrike } from '#gw2/professions/guardian/core/mechanics/trigger-points.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianRuntimeState } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { justiceActivated, type JusticeActivation } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { activeSymbolicAvengerExpirations } from '#gw2/professions/guardian/core/state.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import { emitTraitSymbol } from '#gw2/professions/guardian/core/traits/symbols.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntime } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Owns Furious Focus's live tuning and trait behavior. */
export const furiousFocus = defineTrait({
  name: 'Furious Focus',
  id: TRAIT.FURIOUS_FOCUS,
  balance: { damageIncrease: 0.1 },
  modifierRules: [
    {
      order: -6,
      id: 'guardian.furious-focus',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.FURIOUS_FOCUS, 'damageIncrease'),
      when: (context) => Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
    }
  ],
  triggers: [onTriggerPoint(justiceActivated, { run: placeFuriousFocusSymbol })]
});

/** Owns Symbolic Exposure's live tuning and trait behavior. */
export const symbolicExposure = defineTrait({
  name: 'Symbolic Exposure',
  id: TRAIT.SYMBOLIC_EXPOSURE,
  balance: {
    damageMultiplier: 1.05,
    effects: [
      {
        type: 'condition',
        name: CONDITION.VULNERABILITY,
        condition: CONDITION.VULNERABILITY,
        stacks: 2,
        duration: 5,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  modifierRules: [
    {
      id: 'guardian.symbolic-exposure',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.SYMBOLIC_EXPOSURE, 'damageMultiplier'),
      order: 100,
      when: (context) => targetConditionActive(context, CONDITION.VULNERABILITY)
    }
  ],
  triggers: [
    {
      order: -1,
      emit: TRAIT.SYMBOLIC_EXPOSURE,
      on: 'damage.resolved',
      when: (_runtime, event, details) =>
        event.actorType === ACTOR.PLAYER &&
        Number(event.coefficient) > 0 &&
        (details.hitContext?.damage ?? 0) > 0 &&
        event.metadata?.guardianSymbol === true,
      effects: (effect) => effect.type === 'condition' && effect.name === CONDITION.VULNERABILITY,
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
  name: 'Symbolic Avenger',
  id: TRAIT.SYMBOLIC_AVENGER,
  balance: {
    maximumDamageStacks: 5,
    damageIncreasePerStack: 0.01,
    maximumStacks: 5,
    pulseInterval: 15
  },
  modifierRules: [
    {
      order: -5,
      id: 'guardian.symbolic-avenger',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',

      amount: (context) =>
        Math.min(
          balanceNumberFromContext(context, TRAIT.SYMBOLIC_AVENGER, 'maximumDamageStacks'),
          activeSymbolicAvengerExpirations(guardianRuntimeState(context), context.time).length
        ) * balanceNumberFromContext(context, TRAIT.SYMBOLIC_AVENGER, 'damageIncreasePerStack')
    }
  ],
  triggers: [
    onTriggerPoint(guardianStruck, {
      when: (_runtime, { cause }: GuardianStrike) => cause.metadata?.guardianSymbol === true,
      run: stackSymbolicAvenger
    })
  ]
});

/** Owns Zealot's Resolution's live tuning and trait behavior. */
export const zealotsResolution = defineTrait({
  name: "Zealot's Resolution",
  id: TRAIT.ZEALOTS_RESOLUTION,
  balance: { threshold: 0.25 },
  // The threshold-crossing symbol hit cannot trigger its own reward.
  triggers: [
    onTriggerPoint(guardianStruck, {
      when: (_runtime, { cause }: GuardianStrike) => cause.skillId !== ID.LESSER_SYMBOL_OF_RESOLUTION,
      run: placeZealotsResolutionSymbol
    })
  ]
});

/** Owns Zealous Blade's live tuning and trait behavior. */
export const zealousBlade = defineTrait({
  name: 'Zealous Blade',
  id: TRAIT.ZEALOUS_BLADE,
  balance: {
    conditionalAttributeBonuses: { power: 240 },
    attributeBonuses: { power: 120 },
    rechargeMultiplier: 0.8
  },
  attributes: ({ balanceContext: profileContext, loadout, weaponSet }) => {
    const zealousBladeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ZEALOUS_BLADE);
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
    const mainHand = weapons[0] || '';
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: attributeBonusNumber(zealousBladeProfile, 'power'),
          feedsConversions: 'none'
        },
        {
          // Only the extra greatsword Power feeds conversions; retain the profile's total weapon bonus.
          kind: 'flat',
          to: 'Power',
          amount:
            attributeBonusNumber(zealousBladeProfile, 'power', 'conditionalAttributeBonuses') -
            attributeBonusNumber(zealousBladeProfile, 'power'),
          feedsConversions: 'all',
          enabled: mainHand === WEAPON.GREATSWORD
        }
      ]
    };
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === WEAPON.GREATSWORD,
      multiplier: { profile: TRAIT.ZEALOUS_BLADE, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Kindled Zeal's live tuning and trait behavior. */
export const kindledZeal = defineTrait({
  name: 'Kindled Zeal',
  id: TRAIT.KINDLED_ZEAL,
  balance: { attributeConversion: 0.1 },
  attributes: traitAttributeEffects(TRAIT.KINDLED_ZEAL, [
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
  name: 'Eternal Armory',
  id: TRAIT.ETERNAL_ARMORY,
  balance: {
    resourceGain: 1
  },
  hooks: { maximumAmmo: eternalArmoryMaximumAmmo }
});

/** Owns Fiery Wrath's live tuning and trait behavior. */
export const fieryWrath = defineTrait({
  name: 'Fiery Wrath',
  id: TRAIT.FIERY_WRATH,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.05 },
  modifierRules: [
    {
      id: 'guardian.fiery-wrath',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.FIERY_WRATH, 'damageMultiplier'),
      order: 100,
      when: (context) => targetConditionActive(context, CONDITION.BURNING)
    }
  ]
});

/** Ready Justice activations claim symbol recharge at the permanent Alacrity rate. */
function placeFuriousFocusSymbol(runtime: GuardianRuntime, { cast }: JusticeActivation): void {
  const profile = runtime.helpers.skillsById.get(ID.LESSER_SYMBOL_OF_BLADES)!;

  if (!requireEffect(profile, 'strike', 'Strike')) return;

  const cause = { ...guardianCastCause(runtime, cast), type: 'action' as const };
  // The symbol reserves shared player recharge before its effects can trigger another activation.
  emitTraitSymbol(runtime, TRAIT.FURIOUS_FOCUS, ID.LESSER_SYMBOL_OF_BLADES, cause);
}

/** Accepted symbol impacts add a Symbolic Avenger stack before Zealot's Resolution decides. */
function stackSymbolicAvenger(runtime: GuardianRuntime, { cause: event }: GuardianStrike): void {
  const state = runtime.profession.core;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SYMBOLIC_AVENGER);
  state.symbolicAvengerExpirations = grantTimedStacks(state.symbolicAvengerExpirations, {
    at: runtime.time,
    expiresAt: canonicalTime(runtime.time + balanceProfileNumber(profile, 'pulseInterval')),
    count: 1,
    maximumStacks: balanceProfileNumber(profile, 'maximumStacks'),
    retain: 'latest-expiry'
  });
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: profile.name,
      at: runtime.time,
      sourceSkill: event.skillName,
      detail: `${state.symbolicAvengerExpirations.length}/${balanceProfileNumber(profile, 'maximumStacks')} stacks`,
      icon: guardianTraitIcon(TRAIT.SYMBOLIC_AVENGER)
    }
  });
}

/** Zealot's Resolution samples target health before the current hit. */
function placeZealotsResolutionSymbol(runtime: GuardianRuntime, { cause: event, damage }: GuardianStrike): void {
  const health = runtime.config.target?.health ?? 0;
  // Detached previews pin target health; ordinary simulations still evaluate the health before this hit.
  const lostFraction =
    runtime.config.target?.fixedHealthFraction != null
      ? 1 - runtime.config.target.fixedHealthFraction
      : health > 0
        ? (runtime.combat.targetHealthLoss() - damage) / health
        : 0;

  if (!(lostFraction > balanceNumberFromContext(runtime, TRAIT.ZEALOTS_RESOLUTION, 'threshold'))) return;

  // The profile owns this symbol's Alacrity-aware recharge; removed symbols do not consume it.
  emitTraitSymbol(runtime, TRAIT.ZEALOTS_RESOLUTION, ID.LESSER_SYMBOL_OF_RESOLUTION, event);
}

/** Spirit weapons gain their extra capacity before the runtime constructs ammunition pools. */
function eternalArmoryMaximumAmmo(context: MaximumAmmoContext<object>, skill: Skill, maximum: number): number {
  return skill.categories?.includes('SpiritWeapon') && context.hasTrait(TRAIT.ETERNAL_ARMORY)
    ? maximum + balanceProfileNumber(context.requireBalanceProfile(TRAIT.ETERNAL_ARMORY), 'resourceGain')
    : maximum;
}
