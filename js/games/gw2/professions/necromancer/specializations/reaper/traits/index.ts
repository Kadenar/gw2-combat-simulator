// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { targetConditionStacks as configuredTargetConditionStacks } from '#gw2/platform/combat/state/targets.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';

import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';

import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  type cloneNecromancerAttributes,
  necromancerActiveShroud
} from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

/** Accepted Chill admits Bleeding only through the selected, enabled trait trigger. */
export const deathlyChill = defineTrait({
  id: TRAIT.DEATHLY_CHILL,
  name: 'Deathly Chill',
  balance: {
    effects: [
      {
        name: 'Bleeding',
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 4,
        actorType: 'effect'
      }
    ]
  },
  triggers: [
    { on: 'condition.applied', when: (_runtime, event) => event.condition === 'Chilled', run: applyDeathlyChill }
  ]
});

/** Critical-hit admission is isolated from completion of an already emitted Nova strike. */
export const chillingNova = defineTrait({
  id: TRAIT.CHILLING_NOVA,
  name: 'Chilling Nova',
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
        actorType: 'effect'
      },
      {
        name: 'Chilled',
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'effect'
      }
    ]
  },
  triggers: [
    {
      on: 'damage.resolved',
      when: (runtime, event) =>
        event.actorType === 'player' &&
        Number(event.coefficient) > 0 &&
        runtime.combat.targetHasCondition('Chilled', event.at),
      // Preserve canonical critical sampling and cooldown claims within the selected producer.
      run: criticalProcHandler<NecromancerResolverContext, NecromancerResolverEvent, NativeResolvedDamageDetails>({
        id: 'necromancer.chilling-nova',
        chanceOnCriticalHit: (context) =>
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CHILLING_NOVA), 'criticalChance'),
        internalCooldown: {
          duration: (context) =>
            balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CHILLING_NOVA), 'cooldown'),
          readyAt: (context) => context.procs.deadline('necromancer.reaper.chillingNova') || 0,
          setReadyAt: (context, readyAt) => {
            context.procs.setDeadline('necromancer.reaper.chillingNova', readyAt);
          }
        },
        handler: (context, event, _details, application) => {
          // Chilling Nova is a discrete strike-and-chill package for each materialized proc.
          const profile = requireBalanceProfileFromContext(context, TRAIT.CHILLING_NOVA);
          const strike = requireEffect(profile, 'strike', 'Strike');
          const chill = requireEffect(profile, 'condition', 'Chilled');
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
export const shiversOfDread = defineTrait({
  id: TRAIT.SHIVERS_OF_DREAD,
  name: 'Shivers of Dread',
  balance: {
    effects: [
      {
        name: 'Chilled',
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'effect'
      }
    ]
  },
  triggers: [
    { on: 'condition.applied', when: (_runtime, event) => event.condition === 'Fear', run: applyShiversOfDread }
  ]
});

/** Owns Augury of Death tuning and behavior at its existing execution boundaries. */
export const auguryOfDeath = defineTrait({
  id: TRAIT.AUGURY_OF_DEATH,
  name: 'Augury of Death',
  balance: {
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        // The simulator assumes melee range, doubling the base siphon and its power scaling.
        flatStrikeBase: 344,
        flatStrikePowerCoeff: 0.025,
        actorType: 'effect',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    {
      order: 0,

      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Shout')),
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
export const chillingVictory = defineTrait({
  id: TRAIT.CHILLING_VICTORY,
  name: 'Chilling Victory',
  balance: {
    cooldown: 1,
    lifeForceGain: 1
  },
  triggers: [
    {
      on: 'damage.resolved',
      when: (runtime, event) =>
        event.actorType === 'player' &&
        Number(event.coefficient) > 0 &&
        runtime.combat.targetHasCondition('Chilled', runtime.time),
      run(runtime) {
        const profile = requireBalanceProfileFromContext(runtime, TRAIT.CHILLING_VICTORY);
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
export const blightersBoon = defineTrait({
  id: TRAIT.BLIGHTERS_BOON,
  name: "Blighter's Boon",
  balance: {
    lifeForceGain: 1
  },
  triggers: [
    {
      on: 'buff.applied',
      when: (_runtime, event) => isStandardBoon(event.kind) && Boolean(event.resolvedAudience?.includesSelf),
      run(runtime) {
        grantNecromancerLifeForce(
          runtime,
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BLIGHTERS_BOON), 'lifeForceGain')
        );
      }
    }
  ]
});

/** Owns Decimate Defenses tuning and behavior at its existing execution boundaries. */
export const decimateDefenses = defineTrait({
  id: TRAIT.DECIMATE_DEFENSES,
  name: 'Decimate Defenses',
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
        const decimateDefensesProfile = requireBalanceProfileFromContext(context, TRAIT.DECIMATE_DEFENSES);
        return (
          Math.min(
            balanceProfileNumber(decimateDefensesProfile, 'maximumStacks'),
            context.query?.targetConditionStacks
              ? context.query.targetConditionStacks('Vulnerability', context.time, context.runtime)
              : configuredTargetConditionStacks(context.config || {}, 'Vulnerability', context.time, context.runtime)
          ) * balanceProfileNumber(decimateDefensesProfile, 'criticalChancePerStack')
        );
      }
    }
  ]
});

/** Life Reap admits shroud recharge reductions independently of Onslaught's passive attribute policy. */
export const reapersOnslaught = defineTrait({
  id: TRAIT.REAPERS_ONSLAUGHT,
  name: "Reaper's Onslaught",
  balance: {
    attributeBonus: 300,
    rechargeReduction: 1
  },
  triggers: [
    {
      on: 'damage.resolved',
      when: (_runtime, event) =>
        event.actorType === 'player' && Number(event.coefficient) > 0 && event.skillId === ID.LIFE_REAP,
      run(runtime) {
        const reduction = balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, TRAIT.REAPERS_ONSLAUGHT),
          'rechargeReduction'
        );
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
  name: 'Cold Shoulder',
  modifierRules: [
    {
      order: 122,
      id: 'necromancer.cold-shoulder',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      // Share the target's canonical Chilled lifetime with Chilling Nova eligibility.
      when: (context) => targetConditionActive(context, 'Chilled')
    }
  ]
});

/** Owns Soul Eater tuning and behavior at its existing execution boundaries. */
export const soulEater = defineTrait({
  id: TRAIT.SOUL_EATER,
  name: 'Soul Eater',
  modifierRules: [
    {
      order: 123,
      id: 'necromancer.soul-eater',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15
    }
  ]
});

/** Registers each native trait owner once in its existing execution order. */
export const necromancerReaperTraits = [
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

/** Applies Reaper's Onslaught at the original attribute-conversion position. */
export function modifyReapersOnslaughtAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.REAPERS_ONSLAUGHT) && necromancerActiveShroud(context) === 'reaper') {
    const reapersOnslaughtProfile = requireBalanceProfileFromContext(context, TRAIT.REAPERS_ONSLAUGHT);
    result.ferocity += balanceProfileNumber(reapersOnslaughtProfile, 'attributeBonus');
  }
}

function queueChillingNovaChill(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // The accepted strike owns delivery order; the live named Chill owns its payload.
  emitTraitProfile(context, TRAIT.CHILLING_NOVA, TRAIT.CHILLING_NOVA, undefined, {
    at: event.at,
    effect: { type: 'condition', name: 'Chilled' },
    attribution: { skillName: 'Chilling Nova', name: 'Chilling Nova — Chilled' }
  });
}

/** Finish an admitted Nova strike even when new trait producers are disabled or the trait is unselected. */
function completeChillingNova(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // The resolved Nova strike queues its condition after sibling strikes, preserving their pre-Chill state.
  if (event.actorType === 'effect' && event.sourceId === TRAIT.CHILLING_NOVA) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.CHILLING_NOVA);
    const chill = requireEffect(profile, 'condition', 'Chilled');
    if (chill) queueChillingNovaChill(context, event);
  }
}

/** Converts Chilled applications into Deathly Chill's configured condition packet. */
function applyDeathlyChill(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.DEATHLY_CHILL);
  const effect = requireEffect(profile, 'condition', 'Bleeding');
  if (effect) {
    // Trait payloads and their timeline annotation share the same emission boundary.
    emitTraitProfile(context, TRAIT.DEATHLY_CHILL, TRAIT.DEATHLY_CHILL, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: 'Bleeding' },
      settlement: 'reaction',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.DEATHLY_CHILL,
        actorType: 'effect',
        skillName: 'Deathly Chill',
        triggeredBy: event.skillName,
        ownerActorType: 'player',
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
  const profile = requireBalanceProfileFromContext(context, TRAIT.SHIVERS_OF_DREAD);
  const chill = requireEffect(profile, 'condition', 'Chilled');
  if (!chill) return;
  emitTraitProfile(context, TRAIT.SHIVERS_OF_DREAD, TRAIT.SHIVERS_OF_DREAD, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: 'Chilled' },
    attribution: {
      name: 'Shivers of Dread — Chilled',
      source: 'Trait',
      sourceId: TRAIT.SHIVERS_OF_DREAD,
      actorType: 'effect',
      skillName: 'Shivers of Dread'
    }
  });
}
