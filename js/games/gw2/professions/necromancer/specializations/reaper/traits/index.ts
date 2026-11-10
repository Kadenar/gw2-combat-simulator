// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { targetConditionStacks as configuredTargetConditionStacks } from '#gw2/platform/combat/state/targets.js';
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  attributeBonusNumber,
  balanceNumber,
  balanceProfileNumber,
  requireBalanceProfile,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { necromancerActiveShroud } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Shroud Knight owns Reaper Shroud's intrinsic life-force drain. */
const shroudKnight = defineTrait({
  id: TRAIT.SHROUD_KNIGHT,
  balance: { lifeForceDrain: 4, effects: [] }
});

/** Accepted Chill admits Bleeding only through the selected, enabled trait trigger. */
const deathlyChill = defineTrait({
  id: TRAIT.DEATHLY_CHILL,
  balance: {
    effects: [
      {
        name: CONDITION.BLEEDING,
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 4,
        duration: 4,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  triggers: [
    {
      on: 'condition.applied',
      when: (_runtime, event) => event.condition === CONDITION.CHILLED,
      run: applyDeathlyChill
    }
  ]
});

/** Critical-hit admission is isolated from completion of an already emitted Nova strike. */
const chillingNova = defineTrait({
  id: TRAIT.CHILLING_NOVA,
  balance: {
    cooldown: 3,
    criticalChance: 1,
    effects: [
      {
        name: 'Strike',
        canCrit: false,
        type: 'strike',
        coefficient: 1.125,
        hits: 1,
        actorType: ACTOR.EFFECT
      },
      {
        name: CONDITION.CHILLED,
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  triggers: [
    {
      on: 'damage.resolved',
      when: (runtime, event) =>
        event.actorType === ACTOR.PLAYER &&
        Number(event.coefficient) > 0 &&
        runtime.combat.targetHasCondition(CONDITION.CHILLED, event.at),
      // Preserve canonical critical sampling and cooldown claims within the selected producer.
      run: criticalProcHandler<NecromancerResolverContext, NecromancerResolverEvent, NativeResolvedDamageDetails>({
        id: 'necromancer.chilling-nova',
        chanceOnCriticalHit: (context) => balanceNumber(context.helpers, TRAIT.CHILLING_NOVA, 'criticalChance'),
        internalCooldown: {
          duration: (context) => balanceNumber(context.helpers, TRAIT.CHILLING_NOVA, 'cooldown'),
          key: 'necromancer.reaper.chillingNova'
        },
        handler: (context, event, _details, application) => {
          // Chilling Nova is a discrete strike-and-chill package for each materialized proc.
          const profile = requireBalanceProfile(context.helpers, TRAIT.CHILLING_NOVA);
          const strike = requireEffect(profile, 'strike', 'Strike');
          const chill = requireEffect(profile, 'condition', CONDITION.CHILLED);
          for (let proc = 0; proc < application.quantity; proc += 1) {
            if (strike) {
              // Trait payloads and their timeline annotation share the same emission boundary.
              emitTraitProfile(context, TRAIT.CHILLING_NOVA, TRAIT.CHILLING_NOVA, undefined, {
                at: event.at,
                effect: { type: 'strike', name: 'Strike' },
                skillWeaponFallback: 'Unequipped',
                attribution: { skillName: 'Chilling Nova', name: 'Chilling Nova', triggeredBy: event.skillName },
                transform: (packet) => ({ ...packet, ...(event.summonOwner ? { summonOwner: event.summonOwner } : {}) })
              });
              context.effects.emit({
                kind: 'announcement',
                announcement: { type: 'trait', name: 'Chilling Nova', at: event.at, sourceSkill: event.skillName }
              });
            }
            // Without its strike, Chill has no resolved hit to follow and applies at the trigger instead.
            else if (chill) queueChillingNovaChill(context, event);
          }
        }
      })
    }
  ],
  lifetime: { reactions: { 'damage.resolved': completeChillingNova } }
});

/** Accepted Fear admits its Chill through the same compiled condition stage as other trait producers. */
const shiversOfDread = defineTrait({
  id: TRAIT.SHIVERS_OF_DREAD,
  balance: {
    effects: [
      {
        name: CONDITION.CHILLED,
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  triggers: [
    { on: 'condition.applied', when: (_runtime, event) => event.condition === CONDITION.FEAR, run: applyShiversOfDread }
  ]
});

/** Owns Augury of Death tuning and behavior at its existing execution boundaries. */
const auguryOfDeath = defineTrait({
  id: TRAIT.AUGURY_OF_DEATH,
  balance: {
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        // The simulator assumes melee range, doubling the base siphon and its power scaling.
        flatStrikeBase: 1500,
        flatStrikePowerCoeff: 0.025,
        actorType: ACTOR.EFFECT,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    {
      order: 0,

      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.skillFamily === 'Shout',
      emit: TRAIT.AUGURY_OF_DEATH,
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, cast) => ({
        skillId: undefined,
        skillName: 'Augury of Death',
        name: 'Augury of Death',
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget,
        skillWeapon: 'Unequipped'
      })
    }
  ]
});

/** Selected chilled-target hits claim the existing cooldown before granting life force. */
const chillingVictory = defineTrait({
  id: TRAIT.CHILLING_VICTORY,
  balance: {
    cooldown: 1,
    lifeForceGain: 1
  },
  triggers: [
    {
      on: 'damage.resolved',
      when: (runtime, event) =>
        event.actorType === ACTOR.PLAYER &&
        Number(event.coefficient) > 0 &&
        runtime.combat.targetHasCondition(CONDITION.CHILLED, runtime.time),
      run(runtime) {
        const profile = requireBalanceProfile(runtime.helpers, TRAIT.CHILLING_VICTORY);

        if (
          runtime.procs.claimCooldown(
            'necromancer.reaper.chillingVictory',
            runtime.time,
            balanceProfileNumber(profile, 'cooldown')
          )
        )
          grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
      }
    }
  ]
});

/** Only standard boons actually delivered to self admit a life-force reward. */
const blightersBoon = defineTrait({
  id: TRAIT.BLIGHTERS_BOON,
  balance: {
    lifeForceGain: 1
  },
  triggers: [
    {
      on: 'buff.applied',
      when: (_runtime, event) => isStandardBoon(event.kind) && Boolean(event.resolvedAudience?.includesSelf),
      run(runtime) {
        grantNecromancerLifeForce(runtime, balanceNumber(runtime.helpers, TRAIT.BLIGHTERS_BOON, 'lifeForceGain'));
      }
    }
  ]
});

/** Owns Decimate Defenses tuning and behavior at its existing execution boundaries. */
const decimateDefenses = defineTrait({
  id: TRAIT.DECIMATE_DEFENSES,
  balance: {
    maximumStacks: 25,
    criticalChancePerStack: 0.02
  },
  modifierRules: [
    {
      order: 1,
      id: 'necromancer.decimate-defenses',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => {
        const decimateDefensesProfile = requireBalanceProfile(context.catalog, TRAIT.DECIMATE_DEFENSES);
        return (
          Math.min(
            balanceProfileNumber(decimateDefensesProfile, 'maximumStacks'),
            context.query?.targetConditionStacks
              ? context.query.targetConditionStacks(CONDITION.VULNERABILITY, context.time, context.runtime)
              : configuredTargetConditionStacks(
                  context.config || {},
                  CONDITION.VULNERABILITY,
                  context.time,
                  context.runtime
                )
          ) * balanceProfileNumber(decimateDefensesProfile, 'criticalChancePerStack')
        );
      }
    }
  ]
});

/** Life Reap admits shroud recharge reductions independently of Onslaught's passive attribute policy. */
const reapersOnslaught = defineTrait<NecromancerSkill>({
  id: TRAIT.REAPERS_ONSLAUGHT,
  balance: {
    attributeBonuses: { ferocity: 300 },
    rechargeReduction: 1
  },
  // Reaper Shroud enables Ferocity through the shared trait evaluator.
  attributes(context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: attributeBonusNumber(context.balanceContext.catalog, TRAIT.REAPERS_ONSLAUGHT, 'ferocity'),
          feedsConversions: 'none',
          enabled: necromancerActiveShroud(context) === 'reaper'
        }
      ]
    };
  },
  triggers: [
    {
      on: 'damage.resolved',
      when: (_runtime, event) =>
        event.actorType === ACTOR.PLAYER && Number(event.coefficient) > 0 && event.skillId === ID.LIFE_REAP,
      run(runtime) {
        const reduction = balanceNumber(runtime.helpers, TRAIT.REAPERS_ONSLAUGHT, 'rechargeReduction');
        for (const skill of runtime.helpers.skillsById.values()) {
          if (skill.shroud === 'reaper') runtime.cooldownController.reduceSkillRecharge(skill, reduction, runtime.time);
        }
      }
    }
  ]
});

/** Owns Cold Shoulder tuning and behavior at its existing execution boundaries. */
export const coldShoulder = defineTrait({
  id: TRAIT.COLD_SHOULDER,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.15 },
  modifierRules: [
    {
      order: 122,
      id: 'necromancer.cold-shoulder',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumber(context.catalog, TRAIT.COLD_SHOULDER, 'damageMultiplier'),
      // Share the target's canonical Chilled lifetime with Chilling Nova eligibility.
      when: (context) => targetConditionActive(context, CONDITION.CHILLED)
    }
  ]
});

/** Owns Soul Eater tuning and behavior at its existing execution boundaries. */
const soulEater = defineTrait({
  id: TRAIT.SOUL_EATER,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.15 },
  modifierRules: [
    {
      order: 123,
      id: 'necromancer.soul-eater',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumber(context.catalog, TRAIT.SOUL_EATER, 'damageMultiplier')
    }
  ]
});

/** Registers each native trait owner once in its existing execution order. */
export const necromancerReaperTraits = [
  shroudKnight,
  deathlyChill,
  chillingNova,
  reapersOnslaught,
  shiversOfDread,
  auguryOfDeath,
  chillingVictory,
  blightersBoon,
  decimateDefenses,
  coldShoulder,
  soulEater
];

function queueChillingNovaChill(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // The accepted strike owns delivery order; the live named Chill owns its payload.
  emitTraitProfile(context, TRAIT.CHILLING_NOVA, TRAIT.CHILLING_NOVA, undefined, {
    at: event.at,
    effect: { type: 'condition', name: CONDITION.CHILLED },
    attribution: { skillName: 'Chilling Nova', name: 'Chilling Nova - Chilled' }
  });
}

/** Finish an admitted Nova strike even when new trait producers are disabled or the trait is unselected. */
function completeChillingNova(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // The resolved Nova strike queues its condition after sibling strikes, preserving their pre-Chill state.
  if (event.actorType === ACTOR.EFFECT && event.sourceId === TRAIT.CHILLING_NOVA) {
    const profile = requireBalanceProfile(context.helpers, TRAIT.CHILLING_NOVA);
    const chill = requireEffect(profile, 'condition', CONDITION.CHILLED);

    if (chill) queueChillingNovaChill(context, event);
  }
}

/** Converts Chilled applications into Deathly Chill's configured condition packet. */
function applyDeathlyChill(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const profile = requireBalanceProfile(context.helpers, TRAIT.DEATHLY_CHILL);
  const effect = requireEffect(profile, 'condition', CONDITION.BLEEDING);

  if (effect) {
    // Trait payloads and their timeline annotation share the same emission boundary.
    emitTraitProfile(context, TRAIT.DEATHLY_CHILL, TRAIT.DEATHLY_CHILL, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: CONDITION.BLEEDING },
      settlement: 'reaction',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.DEATHLY_CHILL,
        actorType: ACTOR.EFFECT,
        skillName: 'Deathly Chill',
        triggeredBy: event.skillName,
        ownerActorType: ACTOR.PLAYER,
        name: 'Deathly Chill' + ' - ' + String(effect.condition)
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Deathly Chill', at: event.at, sourceSkill: event.skillName }
    });
  }
}

/** Emits the Chill reward admitted by the compiled Fear trigger. */
function applyShiversOfDread(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const profile = requireBalanceProfile(context.helpers, TRAIT.SHIVERS_OF_DREAD);
  const chill = requireEffect(profile, 'condition', CONDITION.CHILLED);

  if (!chill) return;

  emitTraitProfile(context, TRAIT.SHIVERS_OF_DREAD, TRAIT.SHIVERS_OF_DREAD, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: CONDITION.CHILLED },
    attribution: {
      name: 'Shivers of Dread - Chilled',
      source: 'Trait',
      sourceId: TRAIT.SHIVERS_OF_DREAD,
      actorType: ACTOR.EFFECT,
      skillName: 'Shivers of Dread'
    }
  });
}
