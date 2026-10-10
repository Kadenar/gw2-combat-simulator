import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { guardianStruck, type GuardianStrike } from '#gw2/professions/guardian/core/mechanics/combat-boundaries.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianRuntimeState } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { justiceActivated, type JusticeActivation } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { activeSymbolicAvengerExpirations } from '#gw2/professions/guardian/core/state.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import { emitTraitSymbol } from '#gw2/professions/guardian/core/traits/symbols.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

/** Owns Furious Focus's live tuning and trait behavior. */
export const furiousFocus = defineTrait({
  id: TRAIT.FURIOUS_FOCUS,
  name: 'Furious Focus',
  triggers: [onTriggerPoint(justiceActivated, { run: placeFuriousFocusSymbol })],
  balance: {
    baseDuration: 4,
    damageIncrease: 0.1,
    cooldownPolicy: 'playerRecharge',
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
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FURIOUS_FOCUS), 'damageIncrease'),
      when: (context) => Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
    }
  ]
});

/** Owns Symbolic Exposure's live tuning and trait behavior. */
export const symbolicExposure = defineTrait({
  id: TRAIT.SYMBOLIC_EXPOSURE,
  name: 'Symbolic Exposure',
  balance: {
    damageMultiplier: 1.05,
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
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SYMBOLIC_EXPOSURE), 'damageMultiplier'),
      order: 100,
      when: (context) => targetConditionActive(context, 'Vulnerability')
    }
  ],
  triggers: [
    {
      order: -1,
      emit: TRAIT.SYMBOLIC_EXPOSURE,
      on: 'damage.resolved',
      when: (_runtime, event, details) =>
        event.actorType === 'player' &&
        Number(event.coefficient) > 0 &&
        (details.hitContext?.damage ?? 0) > 0 &&
        event.metadata?.guardianSymbol === true,
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
  triggers: [
    onTriggerPoint(guardianStruck, {
      when: (_runtime, { cause }: GuardianStrike) => cause.metadata?.guardianSymbol === true,
      run: stackSymbolicAvenger
    })
  ],
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
          balanceProfileNumber(
            requireBalanceProfileFromContext(context, TRAIT.SYMBOLIC_AVENGER),
            'maximumDamageStacks'
          ),
          activeSymbolicAvengerExpirations(guardianRuntimeState(context), context.time).length
        ) *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.SYMBOLIC_AVENGER),
          'damageIncreasePerStack'
        )
    }
  ]
});

/** Owns Zealot's Resolution's live tuning and trait behavior. */
export const zealotsResolution = defineTrait({
  id: TRAIT.ZEALOTS_RESOLUTION,
  name: "Zealot's Resolution",
  // The threshold-crossing symbol hit cannot trigger its own reward.
  triggers: [
    onTriggerPoint(guardianStruck, {
      when: (_runtime, { cause }: GuardianStrike) => cause.skillId !== ID.LESSER_SYMBOL_OF_RESOLUTION,
      run: placeZealotsResolutionSymbol
    })
  ],
  balance: {
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
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
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Greatsword',
      multiplier: { profile: TRAIT.ZEALOUS_BLADE, field: 'rechargeMultiplier' }
    }
  ],

  id: TRAIT.ZEALOUS_BLADE,
  name: 'Zealous Blade',
  balance: {
    weaponAttributeBonus: 240,
    attributeBonus: 120,
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
  hooks: { maximumAmmo: eternalArmoryMaximumAmmo },

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
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.05 },
  modifierRules: [
    {
      id: 'guardian.fiery-wrath',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FIERY_WRATH), 'damageMultiplier'),
      order: 100,
      when: (context) => targetConditionActive(context, 'Burning')
    }
  ]
});

/** Ready Justice activations claim symbol recharge at the permanent Alacrity rate. */
function placeFuriousFocusSymbol(runtime: Runtime, { cast }: JusticeActivation): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS_FOCUS);
  if (!requireEffect(profile, 'strike', 'Strike')) return;
  const cause = { ...guardianCastCause(runtime, cast), type: 'action' as const };
  // The symbol reserves shared player recharge before its effects can trigger another activation.
  emitTraitSymbol(runtime, TRAIT.FURIOUS_FOCUS, ID.LESSER_SYMBOL_OF_BLADES, cause, {
    cooldownKey: 'guardian.core.furiousFocus',
    fieldDuration: () => balanceProfileNumber(profile, 'baseDuration')
  });
}

/** Accepted symbol impacts add a Symbolic Avenger stack before Zealot's Resolution decides. */
function stackSymbolicAvenger(runtime: Runtime, { cause: event }: GuardianStrike): void {
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
function placeZealotsResolutionSymbol(runtime: Runtime, { cause: event, damage }: GuardianStrike): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ZEALOTS_RESOLUTION);
  const health = runtime.config.target?.health ?? 0;
  // Detached previews pin target health; ordinary simulations still evaluate the health before this hit.
  const lostFraction =
    runtime.config.target?.fixedHealthFraction != null
      ? 1 - runtime.config.target.fixedHealthFraction
      : health > 0
        ? (runtime.combat.targetHealthLoss() - damage) / health
        : 0;
  if (!(lostFraction > balanceProfileNumber(profile, 'threshold'))) return;
  // The profile owns this symbol's Alacrity-aware recharge; removed symbols do not consume it.
  emitTraitSymbol(runtime, TRAIT.ZEALOTS_RESOLUTION, ID.LESSER_SYMBOL_OF_RESOLUTION, event, {
    cooldownKey: 'guardian.core.zealotsResolution'
  });
}

/** Spirit weapons gain their extra capacity before the runtime constructs ammunition pools. */
function eternalArmoryMaximumAmmo(context: MaximumAmmoContext<object>, skill: Skill, maximum: number): number {
  return skill.categories?.includes('SpiritWeapon') && context.hasTrait(TRAIT.ETERNAL_ARMORY)
    ? maximum + balanceProfileNumber(context.requireBalanceProfile(TRAIT.ETERNAL_ARMORY), 'resourceGain')
    : maximum;
}
