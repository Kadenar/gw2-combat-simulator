// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.

import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { boonActive, skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { activeChargeCount, consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON, CONDITION, WEAPON, type BoonId } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  attributeBonusNumber,
  balanceNumber,
  balanceProfileNumber,
  procChance,
  requireBalanceProfile,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { isPetStrike, petDerivedConditionMetadata } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import {
  criticalResolved,
  packStrikeApplied,
  weaponSwapped
} from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { qualifiesForFlankingBonuses } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Light on your Feet now grants movement speed, outside the combat model. */
export const lightOnYourFeet = defineTrait({ id: TRAIT.LIGHT_ON_YOUR_FEET });

/** Owns Tail Wind's live tuning and trait behavior. */
export const tailWind = defineTrait({
  id: TRAIT.TAIL_WIND,
  balance: {
    internalCooldown: 9,
    effects: [{ name: BOON.SWIFTNESS, type: 'boon', boon: BOON.SWIFTNESS, duration: 9, stacks: 1 }]
  },
  triggers: [
    onTriggerPoint(weaponSwapped, {
      run: (runtime, input: TriggerPointInput<typeof weaponSwapped>) =>
        weaponSwapBoon(runtime, input, TRAIT.TAIL_WIND, BOON.SWIFTNESS, 'ranger.core.tailWind', 'Tail Wind')
    })
  ]
});

/** Owns Quick Draw's live tuning and trait behavior. */
export const quickDraw = defineTrait({
  id: TRAIT.QUICK_DRAW,
  balance: {
    internalCooldown: 9,
    duration: 5,
    rechargeMultiplier: 0.34,
    effects: [{ name: BOON.QUICKNESS, type: 'boon', boon: BOON.QUICKNESS, duration: 3, stacks: 1 }]
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
  triggers: [
    onTriggerPoint(weaponSwapped, {
      run: (runtime, input: TriggerPointInput<typeof weaponSwapped>) => quickDrawSwap(runtime, input.skill, input.at)
    })
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
  id: TRAIT.FURIOUS_GRIP,
  balance: {
    internalCooldown: 9,
    effects: [{ name: BOON.FURY, type: 'boon', boon: BOON.FURY, duration: 5, stacks: 1 }]
  },
  triggers: [
    onTriggerPoint(weaponSwapped, {
      run: (runtime, input: TriggerPointInput<typeof weaponSwapped>) =>
        weaponSwapBoon(runtime, input, TRAIT.FURIOUS_GRIP, BOON.FURY, 'ranger.core.furiousGrip', 'Furious Grip')
    })
  ]
});

/** Owns Sharpened Edges's live tuning and trait behavior. */
export const sharpenedEdges = defineTrait({
  id: TRAIT.SHARPENED_EDGES,
  balance: {
    // One saved override tunes player and pet proc rolls without changing their critical-hit eligibility.
    procRate: {
      id: 'ranger.sharpened-edges',
      traitId: TRAIT.SHARPENED_EDGES,
      field: 'criticalChance',
      opportunity: 'eligible player or pet critical hit'
    },
    criticalChance: 0.33,
    effects: [{ name: CONDITION.BLEEDING, type: 'condition', condition: CONDITION.BLEEDING, duration: 3, stacks: 1 }]
  },
  triggers: [
    onTriggerPoint(criticalResolved, {
      run: (runtime, input: TriggerPointInput<typeof criticalResolved>) =>
        sharpenedEdgesCritical(runtime, input.event, input.details)
    })
  ]
});

/** Owns Trapper's Expertise's live tuning and trait behavior. */
export const trappersExpertise = defineTrait({
  id: TRAIT.TRAPPERS_EXPERTISE,
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
  },
  // Traps extend their base conditions, with Flame Trap retaining its separate balance field.
  modifierRules: [
    {
      id: 'ranger.trappers-expertise-base-duration',
      target: MODIFIER_TARGET.CONDITION_BASE_DURATION,
      operation: 'multiply',
      factor: (context) => {
        const skill = skillForEvent(context.catalog, context.event, context.skillId);
        return balanceNumber(
          context.catalog,
          TRAIT.TRAPPERS_EXPERTISE,
          skill?.id === ID.FLAME_TRAP ? 'coefficientMultiplier' : 'durationMultiplier'
        );
      },
      when: (context) => skillForEvent(context.catalog, context.event, context.skillId)?.skillFamily === 'Trap'
    }
  ],
  triggers: [
    onTriggerPoint(packStrikeApplied, {
      run: (runtime, input: TriggerPointInput<typeof packStrikeApplied>) =>
        triggerTrappersExpertise(runtime, input.event)
    })
  ]
});

/** Owns Fang and Claw's live tuning and trait behavior. */
export const fangAndClaw = defineTrait({
  id: TRAIT.FANG_AND_CLAW,
  balance: {
    attributeBonuses: { precision: 420, ferocity: 450 }
  }
});

/** Owns Strider's Strength's live tuning and trait behavior. */
export const stridersStrength = defineTrait({
  id: TRAIT.STRIDERS_STRENGTH,
  balance: {
    conditionalAttributeBonuses: { power: 240 },
    attributeBonuses: { power: 120 }
  },
  attributes: ({ balanceContext: profileContext, loadout, weaponSet }) => {
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: attributeBonusNumber(
            profileContext.catalog,
            TRAIT.STRIDERS_STRENGTH,
            'power',
            weapons.includes(WEAPON.SWORD) ? 'conditionalAttributeBonuses' : 'attributeBonuses'
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
  balance: {
    criticalChance: 0.15,
    attributeBonuses: { ferocity: 250 }
  },
  attributes: ({ balanceContext: profileContext, loadout }) => {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: attributeBonusNumber(profileContext.catalog, TRAIT.VICIOUS_QUARRY, 'ferocity'),
          feedsConversions: 'none',
          enabled: loadout.assumptions.fury !== false
        }
      ]
    };
  },
  modifierRules: [
    {
      order: 5,
      id: 'ranger.vicious-quarry-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumber(context.catalog, TRAIT.VICIOUS_QUARRY, 'criticalChance'),
      // Vicious Quarry improves the ranger's Fury; the pet retains its own independent critical chance.
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && boonActive(context, BOON.FURY)
    }
  ]
});

/** Owns Hunter's Tactics's live tuning and trait behavior. */
export const huntersTactics = defineTrait({
  id: TRAIT.HUNTERS_TACTICS,
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
      factor: (context) => balanceNumber(context.catalog, TRAIT.HUNTERS_TACTICS, 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && qualifiesForFlankingBonuses(context)
    },
    {
      order: 2,
      id: 'ranger.hunters-tactics-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumber(context.catalog, TRAIT.HUNTERS_TACTICS, 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && qualifiesForFlankingBonuses(context)
    }
  ]
});

/** Owns Hidden Barbs's live tuning and trait behavior. */
export const hiddenBarbs = defineTrait({
  id: TRAIT.HIDDEN_BARBS,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { conditionDamageMultiplier: 1.2 },
  modifierRules: [
    {
      order: 12,
      id: 'ranger.hidden-barbs',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumber(context.catalog, TRAIT.HIDDEN_BARBS, 'conditionDamageMultiplier'),
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
    procChance(context.helpers, TRAIT.SHARPENED_EDGES, context.config.procRateOverrides),
  actorTypes: [ACTOR.PLAYER, ACTOR.SUMMON] as const,
  when(_context: RangerResolverContext, event: Gw2ResolverEvent): boolean {
    return event.actorType === ACTOR.PLAYER || isPetStrike(event);
  },
  handler(context, event, _details, application): void {
    // Reuse this invocation's authored effect, emitting one bleeding application per threshold proc.
    const profile = requireBalanceProfile(context.helpers, TRAIT.SHARPENED_EDGES);
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
          name: 'Sharpened Edges - ' + packet.condition
        })
      });
  }
} satisfies RangerCriticalHitDefinition);

/** Boon-only swap rewards claim their independent cooldown only when an authored payload survives. */
function weaponSwapBoon(
  context: RangerRuntime,
  { skill, at }: TriggerPointInput<typeof weaponSwapped>,
  trait: SkillId,
  boon: BoonId,
  cooldownKey: string,
  name: string
): void {
  if (context.engagement.startTime == null || at < context.engagement.startTime) return;

  const effectName = boon;
  const profile = requireBalanceProfile(context.helpers, trait);

  if (!requireEffect(profile, 'boon', effectName) || !context.procs.claim(trait, cooldownKey, at)) return;

  emitTraitProfile(context, trait, trait, undefined, {
    at,
    fullEnd: at,
    effect: { type: 'boon', name: effectName },
    attribution: { skillId: skill.id, skillName: name, name }
  });
}

/** Own the selected reward at the committed weapon-swap boundary. */
function quickDrawSwap(context: RangerRuntime, skill: RangerSkill, at: number): void {
  const state = professionCoreState(context.profession);
  const inCombat = context.engagement.startTime != null && at >= context.engagement.startTime;

  if (inCombat && context.procs.claim(TRAIT.QUICK_DRAW, 'ranger.core.quickDraw', at)) {
    const profile = requireBalanceProfile(context.helpers, TRAIT.QUICK_DRAW);
    const effect = requireEffect(profile, 'boon', BOON.QUICKNESS);
    // The recharge window is trait-owned, so it and its cooldown survive a removed quickness packet.
    state.quickDraw = grantCharges(1, at + balanceProfileNumber(profile, 'duration'));

    if (effect)
      emitTraitProfile(context, TRAIT.QUICK_DRAW, TRAIT.QUICK_DRAW, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'boon', name: BOON.QUICKNESS },
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

/** Apply Trapper's Expertise once per trap activation when its damage resolves. */
function triggerTrappersExpertise(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context.profession);
  const skill = skillForEvent(context.helpers, event);

  if (skill?.skillFamily === 'Trap' && event.activationId) {
    const profile = requireBalanceProfile(context.helpers, TRAIT.TRAPPERS_EXPERTISE);
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
        name: "Trapper's Expertise - Crippled",
        triggeredBy: event.skillName
      },
      transform: (packet) => ({ ...packet, fixedDuration: true })
    });
  }
}

const sharpenedEdgesCritical = criticalProcHandler(rangerCoreCriticalReactions);
