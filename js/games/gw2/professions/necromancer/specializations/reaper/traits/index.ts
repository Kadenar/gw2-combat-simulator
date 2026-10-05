import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { targetConditionStacks as configuredTargetConditionStacks } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  reactToReaperDamage,
  reactToCondition,
  applyShiversOfDread
} from '#gw2/professions/necromancer/specializations/reaper/traits/behavior.js';

/** Owns Deathly Chill tuning and behavior at its existing execution boundaries. */
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
  hooks: { reactions: { 'condition.applied': reactToCondition } }
});

/** Owns Chilling Nova tuning and behavior at its existing execution boundaries. */
export const chillingNova = defineTrait({
  id: TRAIT.CHILLING_NOVA,
  name: 'Chilling Nova',
  balance: {
    cooldown: 3,
    criticalChance: 1,
    effects: [
      {
        name: 'Strike',
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
  hooks: { reactions: { 'damage.resolved': reactToReaperDamage } }
});

/** Owns Shivers of Dread tuning and behavior at its existing execution boundaries. */
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
  hooks: { reactions: { 'condition.applied': applyShiversOfDread } }
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

/** Owns Chilling Victory tuning and behavior at its existing execution boundaries. */
export const chillingVictory = defineTrait({
  id: TRAIT.CHILLING_VICTORY,
  name: 'Chilling Victory',
  balance: {
    cooldown: 1,
    lifeForceGain: 1
  },
  hooks: {
    reactions: {
      'damage.resolved'(runtime, event) {
        if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
        if (hasTrait(runtime, TRAIT.CHILLING_VICTORY) && runtime.combat.targetHasCondition('Chilled', runtime.time)) {
          const profile = requireBalanceProfileFromContext(runtime, TRAIT.CHILLING_VICTORY);
          // Chilled player hits claim the profile's cooldown before granting life force.
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
    }
  }
});

/** Owns Blighter's Boon tuning and behavior at its existing execution boundaries. */
export const blightersBoon = defineTrait({
  id: TRAIT.BLIGHTERS_BOON,
  name: "Blighter's Boon",
  balance: {
    lifeForceGain: 1
  },
  hooks: {
    reactions: {
      'buff.applied'(runtime, event) {
        // Personal statuses share this stage with boons but must not award Blighter's Boon life force.
        if (
          isStandardBoon(event.kind) &&
          event.resolvedAudience?.includesSelf &&
          hasTrait(runtime, TRAIT.BLIGHTERS_BOON)
        ) {
          grantNecromancerLifeForce(
            runtime,
            balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BLIGHTERS_BOON), 'lifeForceGain')
          );
        }
      }
    }
  }
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

/** Owns Reaper's Onslaught tuning and behavior at its existing execution boundaries. */
export const reapersOnslaught = defineTrait({
  id: TRAIT.REAPERS_ONSLAUGHT,
  name: "Reaper's Onslaught",
  balance: {
    attributeBonus: 300,
    rechargeReduction: 1
  },
  hooks: {
    reactions: {
      'damage.resolved'(runtime, event) {
        if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
        if (event.skillId === ID.LIFE_REAP && hasTrait(runtime, TRAIT.REAPERS_ONSLAUGHT)) {
          const reduction = balanceProfileNumber(
            requireBalanceProfileFromContext(runtime, TRAIT.REAPERS_ONSLAUGHT),
            'rechargeReduction'
          );
          for (const skill of runtime.helpers.skillsById.values()) {
            if (skill.shroud === 'reaper')
              runtime.cooldownController.reduceSkillRecharge(skill, reduction, runtime.time);
          }
        }
      }
    }
  }
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
