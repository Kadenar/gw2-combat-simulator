import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { isPetStrike, petDerivedConditionMetadata } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { boonActive, skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { activeChargeCount, consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';

import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
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
} from '#gw2/professions/ranger/core/mechanics/combat.js';

import { activeBuff, qualifiesForFlankingBonuses } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
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
    })
  ],
  id: TRAIT.LIGHT_ON_YOUR_FEET,
  name: 'Light on Your Feet',
  balance: {
    damageMultiplier: 1.1,
    conditionDurationBonus: 0.1,
    durationPerTier: 2,
    minimumStacks: 1,
    rechargeMultiplier: 0.8,
    effects: [
      { name: 'light-on-your-feet', type: 'buff', kind: 'light-on-your-feet', duration: 6, stacks: 1 },
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        duration: 10,
        stacks: 10
      }
    ]
  },
  modifierRules: [
    {
      order: 3,
      id: 'ranger.light-on-your-feet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET), 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && activeBuff(context, 'light-on-your-feet')
    },
    {
      order: 4,
      id: 'ranger.light-on-your-feet-condition-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
          'conditionDurationBonus'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && activeBuff(context, 'light-on-your-feet')
    }
  ],
  rechargeRules: [
    {
      order: 2,
      when: (_runtime, skill) => skill.weapon === 'Shortbow',
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
    effects: [{ name: 'swiftness', type: 'boon', boon: 'swiftness', duration: 9, stacks: 1 }]
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
    durationMultiplier: 5,
    rechargeMultiplier: 0.34,
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', duration: 3, stacks: 1 }]
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
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', duration: 5, stacks: 1 }]
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
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', duration: 3, stacks: 1 }]
  }
});

/** Owns Trapper's Expertise's live tuning and trait behavior. */
export const trappersExpertise = defineTrait({
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
        name: 'Crippled',
        type: 'condition',
        condition: 'Crippled',
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
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.STRIDERS_STRENGTH);
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(profile, weapons.includes('Sword') ? 'weaponAttributeBonus' : 'attributeBonus'),
          feedsConversions: false
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
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.VICIOUS_QUARRY), 'criticalChance'),
      // Vicious Quarry improves the ranger's Fury; the pet retains its own independent critical chance.
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && boonActive(context, 'fury')
    }
  ],
  attributes: ({ balanceContext: profileContext, loadout }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.VICIOUS_QUARRY);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
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
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HUNTERS_TACTICS), 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && qualifiesForFlankingBonuses(context)
    },
    {
      order: 2,
      id: 'ranger.hunters-tactics-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HUNTERS_TACTICS), 'criticalChance'),
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
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.HIDDEN_BARBS),
          'conditionDamageMultiplier'
        ),
      when: (context) => context.condition === 'Bleeding'
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
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SHARPENED_EDGES), 'criticalChance'),
  actorTypes: ['player', 'summon'] as const,
  when(_context: RangerResolverContext, event: Gw2ResolverEvent): boolean {
    return event.actorType === 'player' || event.source === 'ranger-pet';
  },
  handler(context, event, _details, application): void {
    // Reuse this invocation's authored effect, emitting one bleeding application per threshold proc.
    const profile = requireBalanceProfileFromContext(context, TRAIT.SHARPENED_EDGES);
    const bleeding = requireEffect(profile, 'condition', 'Bleeding');
    if (!bleeding) return;
    // Each threshold proc uses the canonical condition payload and the triggering pet's independent ownership.
    for (let proc = 0; proc < application.quantity; proc += 1)
      emitTraitProfile(context, TRAIT.SHARPENED_EDGES, TRAIT.SHARPENED_EDGES, undefined, {
        at: event.at,
        effect: { type: 'condition', name: 'Bleeding' },
        attribution: {
          source: isPetStrike(event) ? 'ranger-pet' : 'Trait',
          actorType: isPetStrike(event) ? 'summon' : 'effect',
          ownerActorType: isPetStrike(event) ? undefined : 'player',
          skillId: TRAIT.SHARPENED_EDGES,
          skillName: 'Sharpened Edges',
          triggeredBy: event.skillName
        },
        transform: (packet) => ({
          ...packet,
          ...petDerivedConditionMetadata(context, event),
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
      actorType: 'effect',
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
  const inCombat = context.combatStartTime != null && at >= context.combatStartTime;
  if (inCombat) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.TAIL_WIND);
    const effect = requireEffect(profile, 'boon', 'swiftness');
    // The cooldown gates only swiftness, so a removed boon leaves it ready.
    if (effect && context.procs.claim(TRAIT.TAIL_WIND, 'ranger.core.tailWind', at)) {
      emitTraitProfile(context, TRAIT.TAIL_WIND, TRAIT.TAIL_WIND, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'boon', name: 'swiftness' },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.TAIL_WIND,
          actorType: 'effect',
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
  const inCombat = context.combatStartTime != null && at >= context.combatStartTime;
  if (inCombat && context.procs.claim(TRAIT.QUICK_DRAW, 'ranger.core.quickDraw', at)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.QUICK_DRAW);
    const effect = requireEffect(profile, 'boon', 'quickness');
    // The recharge window is trait-owned, so it and its cooldown survive a removed quickness packet.
    state.quickDraw = grantCharges(1, at + balanceProfileNumber(profile, 'durationMultiplier'));
    if (effect)
      emitTraitProfile(context, TRAIT.QUICK_DRAW, TRAIT.QUICK_DRAW, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'boon', name: 'quickness' },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.QUICK_DRAW,
          actorType: 'effect',
          skillId: skill.id,
          skillName: 'Quick Draw',
          name: 'Quick Draw'
        }
      });
  }
}

/** Own the selected reward at the committed weapon-swap boundary. */
function furiousGripSwap(context: RangerRuntime, skill: RangerSkill, at: number): void {
  const inCombat = context.combatStartTime != null && at >= context.combatStartTime;
  if (inCombat) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.FURIOUS_GRIP);
    const effect = requireEffect(profile, 'boon', 'fury');
    // The cooldown gates only fury, so a removed boon leaves it ready.
    if (effect && context.procs.claim(TRAIT.FURIOUS_GRIP, 'ranger.core.furiousGrip', at)) {
      emitTraitProfile(context, TRAIT.FURIOUS_GRIP, TRAIT.FURIOUS_GRIP, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'boon', name: 'fury' },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FURIOUS_GRIP,
          actorType: 'effect',
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
    const cripple = requireEffect(profile, 'condition', 'Crippled');
    if (!cripple) return;
    if (!claimActivation(state.activationClaims, 'ranger.trappers-expertise', event.activationId)) return;
    emitTraitProfile(context, TRAIT.TRAPPERS_EXPERTISE, TRAIT.TRAPPERS_EXPERTISE, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: 'Crippled' },
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.TRAPPERS_EXPERTISE,
        actorType: 'effect',
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
    const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
    if (vulnerability)
      emitTraitProfile(context, TRAIT.LIGHT_ON_YOUR_FEET, TRAIT.LIGHT_ON_YOUR_FEET, undefined, {
        at: event.at,
        fullEnd: event.at,
        effect: { type: 'condition', name: 'Vulnerability' },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
          actorType: 'effect',
          skillId: TRAIT.LIGHT_ON_YOUR_FEET,
          skillName: 'Light on your Feet',
          name: 'Light on your Feet — Vulnerability',
          triggeredBy: event.skillName
        }
      });
  }
}

const sharpenedEdgesCritical = criticalProcHandler(rangerCoreCriticalReactions);
