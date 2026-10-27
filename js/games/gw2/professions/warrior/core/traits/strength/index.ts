import { RECIPIENT, ACTOR, CONTROL, WEAPON, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';
import { activeBoonStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';

import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  attributeBonusFromContext,
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  burstCompleted,
  burstFirstHit,
  castStarting,
  critical,
  dragonSlashCompleted
} from '#gw2/professions/warrior/core/mechanics/trigger-points.js';

import { warriorActiveBuffStacks } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorResolverContext, WarriorSkill, WarriorRuntime } from '#gw2/professions/warrior/types.js';

/** Using a healing skill grants self boons even when the player is already at full health. */
export const restorativeStrength = defineTrait({
  name: 'Restorative Strength',
  id: TRAIT.RESTORATIVE_STRENGTH,
  balance: {
    effects: [
      { name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, stacks: 5, duration: 6 },
      { name: boonKey(BOON.RESISTANCE), type: 'boon', boon: BOON.RESISTANCE, stacks: 1, duration: 6 }
    ]
  },
  triggers: [
    {
      on: 'castStart',
      when: (_runtime, cast) => cast.skill.type === 'Heal',
      emit: TRAIT.RESTORATIVE_STRENGTH,
      attribution: { audience: { recipients: RECIPIENT.SELF } }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const berserkersPower = defineTrait({
  name: "Berserker's Power",
  id: TRAIT.BERSERKERS_POWER,
  balance: {
    // Damage, presentation, and tooltip consumers share this trait's balance values.
    maximumStacks: 4,
    stackMultiplier: 1,
    damageIncreasePerStack: 0.0375,
    effects: [{ name: 'berserkers-power', type: 'buff', kind: 'berserkers-power', stacks: 1, duration: 15 }]
  },
  modifierRules: [
    {
      order: 1,
      id: 'warrior.berserkers-power',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      // The profile owns tuning; this rule only applies the capped-stack damage formula.
      amount: (context) => {
        const profile = requireBalanceProfileFromContext(context, TRAIT.BERSERKERS_POWER);
        return (
          warriorActiveBuffStacks(context, 'berserkers-power', balanceProfileNumber(profile, 'maximumStacks')) *
          balanceProfileNumber(profile, 'damageIncreasePerStack')
        );
      }
    }
  ],
  triggers: [
    onTriggerPoint(dragonSlashCompleted, {
      run: (runtime, input: TriggerPointInput<typeof dragonSlashCompleted>) =>
        berserkersPowerDragonSlash(runtime, input.cast, input.adrenalineSpent)
    }),
    onTriggerPoint(burstFirstHit, {
      run: (runtime, input: TriggerPointInput<typeof burstFirstHit>) =>
        berserkersPowerBurst(runtime, input.event, input.skill)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const recklessDodge = defineTrait({
  name: 'Reckless Dodge',
  id: TRAIT.RECKLESS_DODGE,
  balance: {
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 1.5, hits: 1 },
      { name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, stacks: 2, duration: 5 }
    ]
  },
  triggers: [
    {
      order: 3,

      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === SHARED_SKILL_IDS.DODGE,
      emit: TRAIT.RECKLESS_DODGE,
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: { source: 'Warrior', actorType: ACTOR.PLAYER, name: 'Reckless Dodge', skillWeapon: '' }
    },
    {
      order: 4,

      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === SHARED_SKILL_IDS.DODGE,
      emit: TRAIT.RECKLESS_DODGE,
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.MIGHT),
      attribution: { name: 'Reckless Dodge — Might', priority: 0 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const braveStride = defineTrait({
  name: 'Brave Stride',
  id: TRAIT.BRAVE_STRIDE,
  balance: {
    resourceGain: 5,
    effects: [{ name: boonKey(BOON.STABILITY), type: 'boon', boon: BOON.STABILITY, stacks: 1, duration: 5 }]
  },
  triggers: [
    onTriggerPoint(burstCompleted, {
      run: (runtime, input: TriggerPointInput<typeof burstCompleted>) => braveStrideCommit(runtime, input.cast)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const peakPerformance = defineTrait({
  name: 'Peak Performance',
  id: TRAIT.PEAK_PERFORMANCE,
  balance: {
    baseBonus: 0.05,
    activeBonus: 0.1,
    effects: [{ name: 'peak-performance', type: 'buff', kind: 'peak-performance', stacks: 1, duration: 6 }]
  },
  modifierRules: [
    {
      order: 2,
      id: 'warrior.peak-performance',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',

      amount: (context) =>
        balanceNumberFromContext(context, TRAIT.PEAK_PERFORMANCE, 'baseBonus') +
        (warriorActiveBuffStacks(context, 'peak-performance', 1)
          ? balanceNumberFromContext(context, TRAIT.PEAK_PERFORMANCE, 'activeBonus')
          : 0)
    }
  ],
  triggers: [
    { on: 'buff.applied', requiresSelection: false, run: peakPerformanceBuff },
    onTriggerPoint(castStarting, {
      run: (runtime, input: TriggerPointInput<typeof castStarting>) => peakPerformanceStart(runtime, input.cast)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const bodyBlow = defineTrait({
  name: 'Body Blow',
  id: TRAIT.BODY_BLOW,
  balance: {
    effects: [
      { name: CONDITION.WEAKNESS, type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 3 },
      { name: CONDITION.VULNERABILITY, type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
    ]
  },
  triggers: [
    {
      order: 1,

      on: 'control.resolved',
      when: (_runtime, event) =>
        event.actorType === ACTOR.PLAYER &&
        [CONTROL.STUN, CONTROL.DAZE, CONTROL.KNOCKBACK, CONTROL.PULL, CONTROL.PUSH, CONTROL.LAUNCH].some(
          (kind) => kind === String(event.controlKind).toLowerCase()
        ),
      emit: TRAIT.BODY_BLOW,
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const aggressiveOnslaught = defineTrait({
  name: 'Aggressive Onslaught',
  id: TRAIT.AGGRESSIVE_ONSLAUGHT,
  balance: {
    internalCooldown: 0.32,
    effects: [{ name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      order: 2,

      on: 'control.resolved',
      when: (_runtime, event) => event.actorType === ACTOR.PLAYER,
      emit: TRAIT.AGGRESSIVE_ONSLAUGHT,
      cooldown: 'profile',
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const buildingMomentum = defineTrait({
  name: 'Building Momentum',
  id: TRAIT.BUILDING_MOMENTUM,
  balance: {
    resourceGain: 15
  },
  triggers: [onTriggerPoint(burstFirstHit, { run: (runtime) => buildingMomentumBurst(runtime) })]
});

/** Owns this trait's tuning and selected contributions. */
export const pinnacleOfStrength = defineTrait({
  name: 'Pinnacle of Strength',
  id: TRAIT.PINNACLE_OF_STRENGTH,
  balance: {
    criticalChance: 0.05,
    attributePerStack: 10
  },
  // Might adds temporary Power without entering ordinary conversions or Blood Reaction.
  attributes(context) {
    const might =
      context.query?.mightStacksAt(context.time, context.runtime, context.event) ??
      activeBoonStacks(context, boonKey(BOON.MIGHT));
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount:
            might * balanceNumberFromContext(context.balanceContext, TRAIT.PINNACLE_OF_STRENGTH, 'attributePerStack'),
          feedsConversions: 'none',
          enabled: true
        }
      ]
    };
  },
  modifierRules: [
    {
      order: 0,
      id: 'warrior.pinnacle-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.PINNACLE_OF_STRENGTH, 'criticalChance')
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const forcefulGreatsword = defineTrait({
  name: 'Forceful Greatsword',
  id: TRAIT.FORCEFUL_GREATSWORD,
  balance: {
    rechargeMultiplier: 0.8,
    attributeBonuses: { power: 120 },
    conditionalAttributeBonuses: { power: 120 },
    // Critical Might has twice the proc chance while wielding a greatsword.
    procChance: 0.5,
    weaponProcChanceMultiplier: 2,
    effects: [{ name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, stacks: 1, duration: 5 }]
  },
  attributes(context) {
    const weapons = context.weaponSet === 2 ? context.loadout.alternateWeapons : context.loadout.weapons;
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: attributeBonusFromContext(context.balanceContext, TRAIT.FORCEFUL_GREATSWORD, 'power'),
          feedsConversions: 'all',
          enabled: true
        },
        {
          kind: 'flat',
          to: 'Power',
          amount: attributeBonusFromContext(
            context.balanceContext,
            TRAIT.FORCEFUL_GREATSWORD,
            'power',
            'conditionalAttributeBonuses'
          ),
          // The greatsword bonus feeds the same conversion pool as the permanent Power grant.
          feedsConversions: 'all',
          enabled: weapons.includes(WEAPON.GREATSWORD)
        }
      ]
    };
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === WEAPON.GREATSWORD,
      multiplier: { profile: TRAIT.FORCEFUL_GREATSWORD, field: 'rechargeMultiplier' }
    }
  ],
  triggers: [
    onTriggerPoint(critical, {
      run: (runtime, input: TriggerPointInput<typeof critical>) =>
        forcefulGreatswordCritical(runtime, input.event, input.opportunity)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const greatFortitude = defineTrait({
  name: 'Great Fortitude',
  id: TRAIT.GREAT_FORTITUDE,
  balance: {
    attributeConversion: 0.1
  },
  attributes(context) {
    // Round eligible Power conversions; temporary Berserk Power never enters this pool.
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Power',
          to: 'Vitality',
          multiplier: balanceNumberFromContext(context.balanceContext, TRAIT.GREAT_FORTITUDE, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible',
          enabled: true
        },
        {
          kind: 'conversion',
          from: 'Power',
          to: 'Ferocity',
          multiplier: balanceNumberFromContext(context.balanceContext, TRAIT.GREAT_FORTITUDE, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible',
          enabled: true
        }
      ]
    };
  }
});

function peakPerformanceBuff(context: WarriorResolverContext, event: Gw2ResolverEvent): void {
  if (Number(event.sourceId) !== TRAIT.PEAK_PERFORMANCE || event.kind !== 'peak-performance') return;

  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Peak Performance',
      at: event.at,
      sourceSkill: event.skillName,
      detail: '+10% strike damage for 6 seconds'
    }
  });
}

function peakPerformanceStart(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  const skill = cast.skill;

  if (!skill.categories?.includes('Physical')) return;

  let at = cast.effectiveEnd;

  if (skill.id === ID.KICK) {
    const strike = skill.effects?.find((effect) => effect.type === 'strike');
    const timing = strike && scaleCastBoundTiming(cast, skill, strike);
    const firstTick = Array.isArray(timing?.ticks) ? timing.ticks[0] : undefined;
    const offsetMs = Number(firstTick?.atMs ?? timing?.atMs ?? skill.castTimeMs ?? 0);
    at = Math.min(at, cast.start + offsetMs / 1000);
  }

  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.PEAK_PERFORMANCE);
    const selectedEffect = requireEffect(traitProfile, 'buff', 'peak-performance');

    if (selectedEffect)
      emitTraitProfile(runtime, TRAIT.PEAK_PERFORMANCE, TRAIT.PEAK_PERFORMANCE, undefined, {
        at: at,
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.PEAK_PERFORMANCE,
          actorType: ACTOR.EFFECT,
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id
        },
        transform: (event) => ({ ...event, name: 'Peak Performance', priority: 0 }),
        effects: (candidate) => candidate === selectedEffect
      });
  }
}

function braveStrideCommit(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  const skill = cast.skill;

  if (skill.movementSkill) {
    grantWarriorResource(runtime, balanceNumberFromContext(runtime, TRAIT.BRAVE_STRIDE, 'resourceGain'));
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BRAVE_STRIDE);
      const selectedEffect = requireEffect(traitProfile, 'boon', boonKey(BOON.STABILITY));

      if (selectedEffect)
        emitTraitProfile(runtime, TRAIT.BRAVE_STRIDE, TRAIT.BRAVE_STRIDE, undefined, {
          at: runtime.time,
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BRAVE_STRIDE,
            actorType: ACTOR.EFFECT,
            skillId: cast.skill.id,
            skillName: cast.skill.name,
            activationId: cast.id
          },
          transform: (event) => ({ ...event, name: 'Brave Stride', priority: 0 }),
          effects: (candidate) => candidate === selectedEffect
        });
    }
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
function buildingMomentumBurst(runtime: WarriorRuntime): void {
  runtime.endurance.grant(balanceNumberFromContext(runtime, TRAIT.BUILDING_MOMENTUM, 'resourceGain'));
}

/** Apply line-owned rewards at the shared reaction boundary. */
function berserkersPowerBurst(runtime: WarriorRuntime, event: Gw2ResolverEvent, skill: WarriorSkill): void {
  if (!skill.dragonSlash && Number(event.metadata?.warriorAdrenalineSpent) > 0) {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BERSERKERS_POWER);
    emitTraitProfile(runtime, TRAIT.BERSERKERS_POWER, TRAIT.BERSERKERS_POWER, event, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.BERSERKERS_POWER,
        actorType: ACTOR.EFFECT,
        skillId: event.skillId,
        skillName: event.skillName
      },
      transform: (packet) => ({
        ...packet,
        priority: 5,
        name: traitProfile.name,
        stacks:
          Number(event.metadata?.warriorBurstTier) * balanceProfileNumber(traitProfile, 'stackMultiplier') +
          Number(packet.stacks)
      }),
      effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type)
    });
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
function forcefulGreatswordCritical(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  opportunity: ReturnType<typeof criticalOpportunity>
): void {
  const weapons = gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet);
  const chance = balanceNumberFromContext(runtime, TRAIT.FORCEFUL_GREATSWORD, 'procChance');
  const proc = advanceCriticalProc(opportunity, {
    id: 'warrior.core.forceful-greatsword',
    at: runtime.time,
    chanceOnCriticalHit: Math.min(
      1,
      chance *
        (weapons.includes(WEAPON.GREATSWORD)
          ? balanceNumberFromContext(runtime, TRAIT.FORCEFUL_GREATSWORD, 'weaponProcChanceMultiplier')
          : 1)
    ),
    randomStream: 'warrior.forceful-greatsword',
    roll: (chance, stream) => runtime.random.roll(chance, stream)
  });

  if (proc) {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.FORCEFUL_GREATSWORD);
    emitTraitProfile(runtime, TRAIT.FORCEFUL_GREATSWORD, TRAIT.FORCEFUL_GREATSWORD, event, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.FORCEFUL_GREATSWORD,
        actorType: ACTOR.EFFECT,
        skillId: event.skillId,
        skillName: event.skillName
      },
      transform: (packet) => ({
        ...packet,
        priority: 5,
        name: traitProfile.name,
        stacks: proc.quantity * Number(packet.stacks)
      }),
      effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type)
    });
  }
}

/** Dragon Slash grants the charge-converted reward at completion. */
function berserkersPowerDragonSlash(
  runtime: WarriorRuntime,
  cast: RuntimeCast<WarriorSkill>,
  adrenalineSpent: number
): void {
  const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BERSERKERS_POWER);
  emitTraitProfile(runtime, TRAIT.BERSERKERS_POWER, TRAIT.BERSERKERS_POWER, undefined, {
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.BERSERKERS_POWER,
      actorType: ACTOR.EFFECT,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({
      ...event,
      name: traitProfile.name,
      stacks: (adrenalineSpent / 10) * balanceProfileNumber(traitProfile, 'stackMultiplier') + Number(event.stacks),
      priority: 5
    }),
    effects: (effect) => effect.type === 'boon' || effect.type === 'buff'
  });
}
