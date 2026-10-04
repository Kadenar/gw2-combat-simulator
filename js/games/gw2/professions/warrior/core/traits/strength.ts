import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import { scaleCastBoundTiming } from '#gw2/platform/effects/materializer.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { WarriorModifierAttributes } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import {
  warriorActiveBuffStacks,
  warriorWieldingWeapon
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource } from '#gw2/professions/warrior/core/mechanics/resource-policy.js';
import type { WarriorResolverContext, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Using a healing skill grants self boons even when the player is already at full health. */
export const restorativeStrength = defineTrait({
  id: TRAIT.RESTORATIVE_STRENGTH,
  name: 'Restorative Strength',
  balance: {
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 5, duration: 6 },
      { name: 'resistance', type: 'boon', boon: 'resistance', stacks: 1, duration: 6 }
    ]
  },
  triggers: [
    {
      on: 'castStart',
      when: (_runtime, cast) => cast.skill.type === 'Heal',
      emit: TRAIT.RESTORATIVE_STRENGTH,
      attribution: { audience: { recipients: 'self' } }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const berserkersPower = defineTrait({
  id: TRAIT.BERSERKERS_POWER,
  name: "Berserker's Power",
  balance: {
    // Damage, presentation, and tooltip consumers share this trait's balance values.
    maximumStacks: 4,
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
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const recklessDodge = defineTrait({
  id: TRAIT.RECKLESS_DODGE,
  name: 'Reckless Dodge',
  balance: {
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 1.5, hits: 1 },
      { name: 'might', type: 'boon', boon: 'might', stacks: 2, duration: 5 }
    ]
  },
  triggers: [
    {
      order: 3,

      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === SHARED_SKILL_IDS.DODGE,
      emit: TRAIT.RECKLESS_DODGE,
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: { source: 'Warrior', actorType: 'player', name: 'Reckless Dodge', skillWeapon: '' }
    },
    {
      order: 4,

      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === SHARED_SKILL_IDS.DODGE,
      emit: TRAIT.RECKLESS_DODGE,
      effects: (effect) => effect.type === 'boon' && effect.name === 'might',
      attribution: { name: 'Reckless Dodge — Might', priority: 0 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const braveStride = defineTrait({
  id: TRAIT.BRAVE_STRIDE,
  name: 'Brave Stride',
  balance: {
    resourceGain: 5,
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 5 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const peakPerformance = defineTrait({
  id: TRAIT.PEAK_PERFORMANCE,
  name: 'Peak Performance',
  balance: {
    effects: [{ name: 'peak-performance', type: 'buff', kind: 'peak-performance', stacks: 1, duration: 6 }]
  },
  modifierRules: [
    {
      order: 2,
      id: 'warrior.peak-performance',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      parameters: {
        baseBonus: 0.05,
        activeBonus: 0.1
      },
      amount: (context, _target, parameters) =>
        parameters.baseBonus + (warriorActiveBuffStacks(context, 'peak-performance', 1) ? parameters.activeBonus : 0)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const bodyBlow = defineTrait({
  id: TRAIT.BODY_BLOW,
  name: 'Body Blow',
  balance: {
    effects: [
      { name: 'Weakness', type: 'condition', condition: 'Weakness', stacks: 1, duration: 3 },
      { name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 6 }
    ]
  },
  triggers: [
    {
      order: 1,

      on: 'control.resolved',
      when: (_runtime, event) =>
        event.actorType === 'player' &&
        ['stun', 'daze', 'knockback', 'pull', 'push', 'launch'].includes(String(event.controlKind).toLowerCase()),
      emit: TRAIT.BODY_BLOW,
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const aggressiveOnslaught = defineTrait({
  id: TRAIT.AGGRESSIVE_ONSLAUGHT,
  name: 'Aggressive Onslaught',
  balance: {
    internalCooldown: 0.32,
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      order: 2,

      on: 'control.resolved',
      when: (_runtime, event) => event.actorType === 'player',
      emit: TRAIT.AGGRESSIVE_ONSLAUGHT,
      icd: 'profile',
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const buildingMomentum = defineTrait({
  id: TRAIT.BUILDING_MOMENTUM,
  name: 'Building Momentum',
  balance: {
    resourceGain: 15
  }
});

/** Owns this trait's tuning and selected contributions. */
export const pinnacleOfStrength = defineTrait({
  id: TRAIT.PINNACLE_OF_STRENGTH,
  name: 'Pinnacle of Strength',
  balance: {
    criticalChance: 0.05,
    attributeBonus: 10
  },
  modifierRules: [
    {
      order: 0,
      id: 'warrior.pinnacle-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PINNACLE_OF_STRENGTH), 'criticalChance')
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const forcefulGreatsword = defineTrait({
  id: TRAIT.FORCEFUL_GREATSWORD,
  name: 'Forceful Greatsword',
  balance: {
    rechargeMultiplier: 0.8,
    attributeBonus: 120,
    weaponAttributeBonus: 120,
    // Critical Might has twice the proc chance while wielding a greatsword.
    procChance: 0.5,
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 1, duration: 5 }]
  },
  buildAttributes(_common, context) {
    const weapons = (context.weaponSet === 2 ? context.build.alternateWeapons : context.build.weapons) || [];
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.FORCEFUL_GREATSWORD),
            'attributeBonus'
          ),
          feedsConversions: true,
          enabled: true
        },
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.FORCEFUL_GREATSWORD),
            'weaponAttributeBonus'
          ),
          feedsConversions: false,
          enabled: weapons.includes('Greatsword')
        }
      ]
    };
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Greatsword',
      multiplier: { profile: TRAIT.FORCEFUL_GREATSWORD, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const greatFortitude = defineTrait({
  id: TRAIT.GREAT_FORTITUDE,
  name: 'Great Fortitude',
  balance: {
    attributeConversion: 0.1
  },
  buildAttributes(_common, context) {
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Power',
          to: 'Vitality',
          multiplier: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.GREAT_FORTITUDE),
            'attributeConversion'
          ),
          rounding: 'none',
          input: 'eligible',
          enabled: true
        },
        {
          kind: 'conversion',
          from: 'Power',
          to: 'Ferocity',
          multiplier: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.GREAT_FORTITUDE),
            'attributeConversion'
          ),
          rounding: 'none',
          input: 'eligible',
          enabled: true
        }
      ]
    };
  }
});

type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

export function peakPerformanceBuff(context: WarriorResolverContext, event: Gw2ResolverEvent): void {
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

// Resolve Strength-owned attributes without hiding their formulas in the cross-line composer.
export function modifyWarriorStrengthAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean,
  gearPower: number
): void {
  if (hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH)) {
    const pinnacleOfStrengthProfile = requireBalanceProfileFromContext(context, TRAIT.PINNACLE_OF_STRENGTH);
    result.power +=
      (context.query?.mightStacksAt(context.time, context.runtime, context.event) || 0) *
      balanceProfileNumber(pinnacleOfStrengthProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.FORCEFUL_GREATSWORD) && !staticRulesApplied) {
    const forcefulGreatswordProfile = requireBalanceProfileFromContext(context, TRAIT.FORCEFUL_GREATSWORD);
    result.power +=
      balanceProfileNumber(forcefulGreatswordProfile, 'attributeBonus') +
      Number(warriorWieldingWeapon(context, 'Greatsword')) *
        balanceProfileNumber(forcefulGreatswordProfile, 'weaponAttributeBonus');
  }

  if (hasTrait(context, TRAIT.GREAT_FORTITUDE) && !staticRulesApplied) {
    const greatFortitudeProfile = requireBalanceProfileFromContext(context, TRAIT.GREAT_FORTITUDE);
    // Static builds already bake this gear-only conversion; live Might and signets must not feed it.
    const conversion = balanceProfileNumber(greatFortitudeProfile, 'attributeConversion');
    result.vitality += gearPower * conversion;
    result.ferocity += gearPower * conversion;
  }
}

export function peakPerformanceStart(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  const skill = cast.skill;
  if (!skill.categories?.includes('Physical') || !hasTrait(runtime, TRAIT.PEAK_PERFORMANCE)) return;
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
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: [selectedEffect],
        at: at,
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.PEAK_PERFORMANCE,
          actorType: 'effect',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id
        },
        transform: (event) => ({ ...event, name: 'Peak Performance', priority: 0 })
      });
  }
}

export function braveStrideCommit(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  const skill = cast.skill;
  if (hasTrait(runtime, TRAIT.BRAVE_STRIDE) && skill.movementSkill) {
    grantWarriorResource(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BRAVE_STRIDE), 'resourceGain')
    );
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BRAVE_STRIDE);
      const selectedEffect = requireEffect(traitProfile, 'boon', 'stability');
      if (selectedEffect)
        runtime.effects.emit({
          kind: 'profile',
          profile: traitProfile,
          effects: [selectedEffect],
          at: runtime.time,
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BRAVE_STRIDE,
            actorType: 'effect',
            skillId: cast.skill.id,
            skillName: cast.skill.name,
            activationId: cast.id
          },
          transform: (event) => ({ ...event, name: 'Brave Stride', priority: 0 })
        });
    }
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function buildingMomentumBurst(runtime: WarriorRuntime): void {
  if (hasTrait(runtime, TRAIT.BUILDING_MOMENTUM))
    runtime.endurance.grant(
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BUILDING_MOMENTUM), 'resourceGain')
    );
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function berserkersPowerBurst(runtime: WarriorRuntime, event: Gw2ResolverEvent, skill: WarriorSkill): void {
  if (
    !skill.dragonSlash &&
    hasTrait(runtime, TRAIT.BERSERKERS_POWER) &&
    Number(event.metadata?.warriorAdrenalineSpent) > 0
  ) {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BERSERKERS_POWER);
    runtime.effects.emit({
      kind: 'profile',
      profile: traitProfile,
      effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.BERSERKERS_POWER,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      cause: event,
      transform: (packet) => ({
        ...packet,
        priority: 5,
        name: traitProfile.name,
        stacks: Number(event.metadata?.warriorBurstTier) + 1
      })
    });
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function forcefulGreatswordCritical(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  opportunity: ReturnType<typeof criticalOpportunity>
): void {
  if (hasTrait(runtime, TRAIT.FORCEFUL_GREATSWORD)) {
    const weapons = gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet);
    const chance = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.FORCEFUL_GREATSWORD),
      'procChance'
    );
    const proc = advanceCriticalProc(opportunity, {
      id: 'warrior.core.forceful-greatsword',
      at: runtime.time,
      chanceOnCriticalHit: Math.min(1, chance * (weapons.includes('Greatsword') ? 2 : 1)),
      randomStream: 'warrior.forceful-greatsword',
      roll: (chance, stream) => runtime.random.roll(chance, stream)
    });
    if (proc) {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.FORCEFUL_GREATSWORD);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FORCEFUL_GREATSWORD,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        cause: event,
        transform: (packet) => ({
          ...packet,
          priority: 5,
          name: traitProfile.name,
          stacks: proc.quantity * Number(packet.stacks)
        })
      });
    }
  }
}

/** Berserk's live power pool participates in Great Fortitude's conversion. */
export function convertBerserkPower(
  context: Gw2ModifierContext,
  result: Gw2MutableStats & { ferocity: number },
  powerBonus: number
): void {
  if (hasTrait(context, TRAIT.GREAT_FORTITUDE)) {
    const greatFortitudeProfile = requireBalanceProfileFromContext(context, TRAIT.GREAT_FORTITUDE);
    const conversion = balanceProfileNumber(greatFortitudeProfile, 'attributeConversion');
    result.vitality = (result.vitality || 0) + powerBonus * conversion;
    result.ferocity += powerBonus * conversion;
  }
}

/** Dragon Slash grants the charge-converted reward at completion. */
export function berserkersPowerDragonSlash(
  runtime: WarriorRuntime,
  cast: RuntimeCast<WarriorSkill>,
  adrenalineSpent: number
): void {
  {
    if (hasTrait(runtime, TRAIT.BERSERKERS_POWER)) {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BERSERKERS_POWER);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: traitProfile.effects?.filter((effect) => effect.type === 'boon' || effect.type === 'buff'),
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.BERSERKERS_POWER,
          actorType: 'effect',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id
        },
        transform: (event) => ({ ...event, name: traitProfile.name, stacks: adrenalineSpent / 10 + 1, priority: 5 })
      });
    }
  }
}
