import { WEAPON, ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { isPetStrike, petDerivedConditionMetadata } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { boonActive, skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { activeChargeCount, consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';

import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';

import {
  bloodThirstApplied,
  criticalResolved,
  dodged,
  packStrikeApplied,
  weaponSwapped
} from '#gw2/professions/ranger/core/mechanics/trigger-points.js';

import { activeBuff, qualifiesForFlankingBonuses } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { shortbowConditionDuration } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Owns Light on Your Feet's live tuning and trait behavior. */
export const lightOnYourFeet = defineTrait({
  triggers: [
    onTriggerPoint(bloodThirstApplied, {
      run: (runtime, input: TriggerPointInput<typeof bloodThirstApplied>) =>
        triggerLightOnYourFeet(runtime, input.event)
    }),
    onTriggerPoint(dodged, {
      run: (runtime, input: TriggerPointInput<typeof dodged>) => applyRangerDodgeTraits(runtime, input.at)
    }),
    {
      // Bumble still grants this buff after its evade was removed; keep the exception trait-local.
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.BUMBLE,
      run: (runtime) => applyRangerDodgeTraits(runtime)
    }
  ],
  id: TRAIT.LIGHT_ON_YOUR_FEET,
  name: 'Light on Your Feet',
  balance: {
    damageMultiplier: 1.1,
    conditionDurationBonus: 0.1,
    durationExtension: 2,
    immobilizeDurationExtension: 1,
    rechargeMultiplier: 0.8,
    effects: [
      { name: 'light-on-your-feet', type: 'buff', kind: 'light-on-your-feet', duration: 6, stacks: 1 },
      {
        name: CONDITION.VULNERABILITY,
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        duration: 10,
        stacks: 10
      }
    ]
  },
  modifierRules: [
    {
      id: 'ranger.light-on-your-feet-base-duration',
      order: 1,
      target: MODIFIER_TARGET.CONDITION_BASE_DURATION,
      operation: 'multiply',
      factor: (context) => {
        const { skillId, base, intrinsic } = shortbowConditionDuration(context);

        if (!(base > 0)) return 1;

        const extension = balanceNumberFromContext(
          context,
          TRAIT.LIGHT_ON_YOUR_FEET,
          skillId === ID.CRIPPLING_SHOT ? 'immobilizeDurationExtension' : 'durationExtension'
        );
        // The weapon already contributes intrinsic seconds; add the trait's seconds to that same base.
        return Math.max(0, base + intrinsic + extension) / (base + intrinsic);
      },
      when: (context) => {
        if (!qualifiesForFlankingBonuses(context)) return false;

        const { skillId } = shortbowConditionDuration(context);
        return (
          (skillId === ID.CROSSFIRE && context.condition === CONDITION.BLEEDING) ||
          (skillId === ID.POISON_VOLLEY && context.condition === CONDITION.POISONED) ||
          (skillId === ID.CRIPPLING_SHOT && context.condition === CONDITION.IMMOBILIZED)
        );
      }
    },
    {
      order: 3,
      id: 'ranger.light-on-your-feet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET, 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && activeBuff(context, 'light-on-your-feet')
    },
    {
      order: 4,
      id: 'ranger.light-on-your-feet-condition-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET, 'conditionDurationBonus'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && activeBuff(context, 'light-on-your-feet')
    }
  ],
  rechargeRules: [
    {
      order: 2,
      when: (_runtime, skill) => skill.weapon === WEAPON.SHORTBOW,
      multiplier: { profile: TRAIT.LIGHT_ON_YOUR_FEET, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Tail Wind's live tuning and trait behavior. */
export const tailWind = defineTrait({
  triggers: [
    onTriggerPoint(weaponSwapped, {
      run: (runtime, input: TriggerPointInput<typeof weaponSwapped>) => tailWindSwap(runtime, input.skill, input.at)
    })
  ],
  id: TRAIT.TAIL_WIND,
  name: 'Tail Wind',
  balance: {
    internalCooldown: 9,
    effects: [{ name: boonKey(BOON.SWIFTNESS), type: 'boon', boon: BOON.SWIFTNESS, duration: 9, stacks: 1 }]
  }
});

/** Owns Quick Draw's live tuning and trait behavior. */
export const quickDraw = defineTrait({
  triggers: [
    onTriggerPoint(weaponSwapped, {
      run: (runtime, input: TriggerPointInput<typeof weaponSwapped>) => quickDrawSwap(runtime, input.skill, input.at)
    })
  ],
  id: TRAIT.QUICK_DRAW,
  name: 'Quick Draw',
  balance: {
    internalCooldown: 9,
    duration: 5,
    rechargeMultiplier: 0.34,
    effects: [{ name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, duration: 3, stacks: 1 }]
  },
  rechargeRules: [
    {
      order: 0,
      when: (runtime: MechanicQueriesOf<RangerRuntime>, skill) =>
        skill.type === 'Weapon' &&
        skill.slot !== 'Weapon_1' &&
        activeChargeCount(runtime.profession.core.quickDraw, runtime.time) > 0,
      multiplier: { profile: TRAIT.QUICK_DRAW, field: 'rechargeMultiplier' }
    }
  ],
  lifetime: {
    reserveRecharge(runtime: RangerRuntime, skill, work) {
      // Quick Draw is reserved at acceptance so concurrent casts cannot consume the same grant twice.
      if (skill.type === 'Weapon' && skill.slot !== 'Weapon_1')
        consumeCharge(runtime.profession.core.quickDraw, runtime.time);

      return work;
    }
  }
});

/** Owns Furious Grip's live tuning and trait behavior. */
export const furiousGrip = defineTrait({
  triggers: [
    onTriggerPoint(weaponSwapped, {
      run: (runtime, input: TriggerPointInput<typeof weaponSwapped>) => furiousGripSwap(runtime, input.skill, input.at)
    })
  ],
  id: TRAIT.FURIOUS_GRIP,
  name: 'Furious Grip',
  balance: {
    internalCooldown: 9,
    effects: [{ name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, duration: 5, stacks: 1 }]
  }
});

/** Owns Sharpened Edges's live tuning and trait behavior. */
export const sharpenedEdges = defineTrait({
  triggers: [
    onTriggerPoint(criticalResolved, {
      run: (runtime, input: TriggerPointInput<typeof criticalResolved>) =>
        sharpenedEdgesCritical(runtime, input.event, input.details)
    })
  ],
  id: TRAIT.SHARPENED_EDGES,
  name: 'Sharpened Edges',
  balance: {
    criticalChance: 0.33,
    effects: [{ name: CONDITION.BLEEDING, type: 'condition', condition: CONDITION.BLEEDING, duration: 3, stacks: 1 }]
  }
});

/** Owns Trapper's Expertise's live tuning and trait behavior. */
export const trappersExpertise = defineTrait({
  // Traps extend their base conditions, with Flame Trap retaining its separate balance field.
  modifierRules: [
    {
      id: 'ranger.trappers-expertise-base-duration',
      target: MODIFIER_TARGET.CONDITION_BASE_DURATION,
      operation: 'multiply',
      factor: (context) => {
        const skill = skillForEvent(context.profession?.catalog, context.event, context.skillId);
        return balanceNumberFromContext(
          context,
          TRAIT.TRAPPERS_EXPERTISE,
          skill?.id === ID.FLAME_TRAP ? 'coefficientMultiplier' : 'durationMultiplier'
        );
      },
      when: (context) =>
        Boolean(
          skillForEvent(context.profession?.catalog, context.event, context.skillId)?.categories?.includes('Trap')
        )
    }
  ],
  triggers: [
    onTriggerPoint(packStrikeApplied, {
      run: (runtime, input: TriggerPointInput<typeof packStrikeApplied>) =>
        triggerTrappersExpertise(runtime, input.event)
    })
  ],
  id: TRAIT.TRAPPERS_EXPERTISE,
  name: "Trapper's Expertise",
  balance: {
    durationMultiplier: 1.6,
    coefficientMultiplier: 1.66,
    effects: [
      {
        name: CONDITION.CRIPPLED,
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        duration: 3,
        stacks: 1
      }
    ]
  }
});

/** Owns Fang and Claw's live tuning and trait behavior. */
export const fangAndClaw = defineTrait({
  id: TRAIT.FANG_AND_CLAW,
  name: 'Fang and Claw',
  balance: {
    attributeBonus: 420,
    weaponAttributeBonus: 450
  }
});

/** Owns Strider's Strength's live tuning and trait behavior. */
export const stridersStrength = defineTrait({
  id: TRAIT.STRIDERS_STRENGTH,
  name: "Strider's Strength",
  balance: {
    weaponAttributeBonus: 240,
    attributeBonus: 120
  },
  attributes: ({ balanceContext: profileContext, loadout, weaponSet }) => {
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceNumberFromContext(
            profileContext,
            TRAIT.STRIDERS_STRENGTH,
            weapons.includes(WEAPON.SWORD) ? 'weaponAttributeBonus' : 'attributeBonus'
          ),
          // Both the permanent and sword-dependent Power bonuses feed conversions.
          feedsConversions: 'all'
        }
      ]
    };
  }
});

/** Owns Vicious Quarry's live tuning and trait behavior. */
export const viciousQuarry = defineTrait({
  id: TRAIT.VICIOUS_QUARRY,
  name: 'Vicious Quarry',
  balance: {
    criticalChance: 0.15,
    attributeBonus: 250
  },
  modifierRules: [
    {
      order: 5,
      id: 'ranger.vicious-quarry-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.VICIOUS_QUARRY, 'criticalChance'),
      // Vicious Quarry improves the ranger's Fury; the pet retains its own independent critical chance.
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && boonActive(context, boonKey(BOON.FURY))
    }
  ],
  attributes: ({ balanceContext: profileContext, loadout }) => {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceNumberFromContext(profileContext, TRAIT.VICIOUS_QUARRY, 'attributeBonus'),
          feedsConversions: 'none',
          enabled: loadout.assumptions.fury !== false
        }
      ]
    };
  }
});

/** Owns Hunter's Tactics's live tuning and trait behavior. */
export const huntersTactics = defineTrait({
  id: TRAIT.HUNTERS_TACTICS,
  name: "Hunter's Tactics",
  balance: {
    damageMultiplier: 1.1,
    criticalChance: 0.1
  },
  modifierRules: [
    {
      order: 1,
      id: 'ranger.hunters-tactics-damage',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.HUNTERS_TACTICS, 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && qualifiesForFlankingBonuses(context)
    },
    {
      order: 2,
      id: 'ranger.hunters-tactics-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.HUNTERS_TACTICS, 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && qualifiesForFlankingBonuses(context)
    }
  ]
});

/** Owns Hidden Barbs's live tuning and trait behavior. */
export const hiddenBarbs = defineTrait({
  id: TRAIT.HIDDEN_BARBS,
  name: 'Hidden Barbs',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { conditionDamageMultiplier: 1.2 },
  modifierRules: [
    {
      order: 12,
      id: 'ranger.hidden-barbs',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.HIDDEN_BARBS, 'conditionDamageMultiplier'),
      // Hidden Barbs boosts the Ranger's bleeding, including owned effects, without amplifying pet bleeds.
      when: (context) => context.condition === CONDITION.BLEEDING && isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

type RangerCriticalHitDefinition = ResolvedCriticalHitOptions<
  RangerResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>;

const rangerCoreCriticalReactions = Object.freeze({
  id: 'ranger.sharpened-edges',
  chanceOnCriticalHit: (context: RangerResolverContext) =>
    balanceNumberFromContext(context, TRAIT.SHARPENED_EDGES, 'criticalChance'),
  actorTypes: [ACTOR.PLAYER, ACTOR.SUMMON] as const,
  when(_context: RangerResolverContext, event: Gw2ResolverEvent): boolean {
    return event.actorType === ACTOR.PLAYER || isPetStrike(event);
  },
  handler(context, event, _details, application): void {
    // Reuse this invocation's authored effect, emitting one bleeding application per threshold proc.
    const profile = requireBalanceProfileFromContext(context, TRAIT.SHARPENED_EDGES);
    const bleeding = requireEffect(profile, 'condition', CONDITION.BLEEDING);

    if (!bleeding) return;

    // Poisonous Cloud's Ranger-owned critical hits grant Ranger bleeds even though their source is ranger-pet.
    const petOwned = event.actorType === ACTOR.SUMMON && isPetStrike(event);
    // Each threshold proc uses the canonical condition payload and the triggering pet's independent ownership.
    for (let proc = 0; proc < application.quantity; proc += 1)
      emitTraitProfile(context, TRAIT.SHARPENED_EDGES, TRAIT.SHARPENED_EDGES, undefined, {
        at: event.at,
        effect: { type: 'condition', name: CONDITION.BLEEDING },
        attribution: {
          source: petOwned ? 'ranger-pet' : 'Trait',
          actorType: petOwned ? ACTOR.SUMMON : ACTOR.EFFECT,
          ownerActorType: petOwned ? undefined : ACTOR.PLAYER,
          skillId: TRAIT.SHARPENED_EDGES,
          skillName: 'Sharpened Edges',
          triggeredBy: event.skillName
        },
        transform: (packet) => ({
          ...packet,
          ...(petOwned ? petDerivedConditionMetadata(context, event) : {}),
          name: 'Sharpened Edges — ' + packet.condition
        })
      });
  }
} satisfies RangerCriticalHitDefinition);

function applyRangerDodgeTraits(context: RangerRuntime, at = context.time): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET);
  const effect = requireEffect(profile, 'buff', 'light-on-your-feet');

  if (!effect) return;

  const kind = String(effect.kind);
  const baseDuration = effectNumber(profile, effect, 'duration');
  // Reapplications stack duration in game, so preserve the live remainder
  // instead of replacing it with another six-second overlapping window.
  const activeUntil = context.facts
    .read()
    .filter((event) => event.type === 'buff' && event.kind === kind && event.at <= at)
    .reduce((maximum, event) => Math.max(maximum, gw2EffectExpiresAt(event.at, event.duration || 0)), at);
  emitTraitProfile(context, TRAIT.LIGHT_ON_YOUR_FEET, TRAIT.LIGHT_ON_YOUR_FEET, undefined, {
    at: at,
    fullEnd: at,
    effect: { type: 'buff', name: 'light-on-your-feet' },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
      actorType: ACTOR.EFFECT,
      skillId: TRAIT.LIGHT_ON_YOUR_FEET,
      skillName: 'Light on your Feet',
      name: 'Light on your Feet'
    },
    transform: (packet) => ({ ...packet, duration: baseDuration + Math.max(0, activeUntil - at) })
  });
}

// Apply combat-only weapon-swap traits on independent ICDs and arm Quick Draw's
// one-use window for the next qualifying weapon skill.
/** Own the selected reward at the committed weapon-swap boundary. */
function tailWindSwap(context: RangerRuntime, skill: RangerSkill, at: number): void {
  const inCombat = context.engagement.startTime != null && at >= context.engagement.startTime;

  if (inCombat) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.TAIL_WIND);
    const effect = requireEffect(profile, 'boon', boonKey(BOON.SWIFTNESS));

    // The cooldown gates only swiftness, so a removed boon leaves it ready.
    if (effect && context.procs.claim(TRAIT.TAIL_WIND, 'ranger.core.tailWind', at)) {
      emitTraitProfile(context, TRAIT.TAIL_WIND, TRAIT.TAIL_WIND, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'boon', name: boonKey(BOON.SWIFTNESS) },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.TAIL_WIND,
          actorType: ACTOR.EFFECT,
          skillId: skill.id,
          skillName: 'Tail Wind',
          name: 'Tail Wind'
        }
      });
    }
  }
}

/** Own the selected reward at the committed weapon-swap boundary. */
function quickDrawSwap(context: RangerRuntime, skill: RangerSkill, at: number): void {
  const state = professionCoreState(context);
  const inCombat = context.engagement.startTime != null && at >= context.engagement.startTime;

  if (inCombat && context.procs.claim(TRAIT.QUICK_DRAW, 'ranger.core.quickDraw', at)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.QUICK_DRAW);
    const effect = requireEffect(profile, 'boon', boonKey(BOON.QUICKNESS));
    // The recharge window is trait-owned, so it and its cooldown survive a removed quickness packet.
    state.quickDraw = grantCharges(1, at + balanceProfileNumber(profile, 'duration'));

    if (effect)
      emitTraitProfile(context, TRAIT.QUICK_DRAW, TRAIT.QUICK_DRAW, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'boon', name: boonKey(BOON.QUICKNESS) },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.QUICK_DRAW,
          actorType: ACTOR.EFFECT,
          skillId: skill.id,
          skillName: 'Quick Draw',
          name: 'Quick Draw'
        }
      });
  }
}

/** Own the selected reward at the committed weapon-swap boundary. */
function furiousGripSwap(context: RangerRuntime, skill: RangerSkill, at: number): void {
  const inCombat = context.engagement.startTime != null && at >= context.engagement.startTime;

  if (inCombat) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.FURIOUS_GRIP);
    const effect = requireEffect(profile, 'boon', boonKey(BOON.FURY));

    // The cooldown gates only fury, so a removed boon leaves it ready.
    if (effect && context.procs.claim(TRAIT.FURIOUS_GRIP, 'ranger.core.furiousGrip', at)) {
      emitTraitProfile(context, TRAIT.FURIOUS_GRIP, TRAIT.FURIOUS_GRIP, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'boon', name: boonKey(BOON.FURY) },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FURIOUS_GRIP,
          actorType: ACTOR.EFFECT,
          skillId: skill.id,
          skillName: 'Furious Grip',
          name: 'Furious Grip'
        }
      });
    }
  }
}

/** Apply Trapper's Expertise once per trap activation when its damage resolves. */
function triggerTrappersExpertise(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const skill = skillForEvent(context.helpers, event);

  if (skill?.categories?.includes('Trap') && event.activationId) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.TRAPPERS_EXPERTISE);
    const cripple = requireEffect(profile, 'condition', CONDITION.CRIPPLED);

    if (!cripple) return;

    if (!claimActivation(state.player.activationClaims, 'ranger.trappers-expertise', event.activationId)) return;

    emitTraitProfile(context, TRAIT.TRAPPERS_EXPERTISE, TRAIT.TRAPPERS_EXPERTISE, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: CONDITION.CRIPPLED },
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.TRAPPERS_EXPERTISE,
        actorType: ACTOR.EFFECT,
        skillId: TRAIT.TRAPPERS_EXPERTISE,
        skillName: "Trapper's Expertise",
        name: "Trapper's Expertise — Crippled",
        triggeredBy: event.skillName
      },
      transform: (packet) => ({ ...packet, fixedDuration: true })
    });
  }
}

/** Apply the trait-selected shortbow condition upgrades after base on-hit effects. */
function triggerLightOnYourFeet(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const skill = skillForEvent(context.helpers, event);

  // Crossfire gains duration through the base-duration hook, never an additional bleed stack.
  if (skill?.id === ID.CONCUSSION_SHOT) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET);
    const vulnerability = requireEffect(profile, 'condition', CONDITION.VULNERABILITY);

    if (vulnerability)
      emitTraitProfile(context, TRAIT.LIGHT_ON_YOUR_FEET, TRAIT.LIGHT_ON_YOUR_FEET, undefined, {
        at: event.at,
        fullEnd: event.at,
        effect: { type: 'condition', name: CONDITION.VULNERABILITY },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
          actorType: ACTOR.EFFECT,
          skillId: TRAIT.LIGHT_ON_YOUR_FEET,
          skillName: 'Light on your Feet',
          name: 'Light on your Feet — Vulnerability',
          triggeredBy: event.skillName
        }
      });
  }
}

const sharpenedEdgesCritical = criticalProcHandler(rangerCoreCriticalReactions);
