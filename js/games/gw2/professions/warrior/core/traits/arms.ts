import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { eventSkill, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { WarriorModifierAttributes } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import {
  warriorActiveBuffStacks,
  warriorBoonActive,
  warriorWieldingWeapon
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Owns this trait's tuning and selected contributions. */
export const signetMastery = defineTrait({
  id: TRAIT.SIGNET_MASTERY,
  name: 'Signet Mastery',
  balance: {
    internalCooldown: 20,
    maximumStacks: 5,
    attributeBonus: 100,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 10, duration: 6 },
      { name: 'signet-mastery', type: 'buff', kind: 'signet-mastery', stacks: 1, duration: 60 }
    ]
  },
  triggers: [
    {
      order: 7,

      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Signet')),
      emit: TRAIT.SIGNET_MASTERY,
      effects: (effect) => effect.type === 'buff' && effect.kind === 'signet-mastery',
      attribution: { name: 'Signet Mastery', priority: 0 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const burstPrecision = defineTrait({
  id: TRAIT.BURST_PRECISION,
  name: 'Burst Precision',
  balance: {
    criticalChance: 1,
    minimumStacks: 2,
    maximumStacks: 4,
    attributeBonus: 250
  },
  modifierRules: [
    {
      order: 6,
      id: 'warrior.burst-precision',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BURST_PRECISION), 'criticalChance'),
      when: (context) =>
        Boolean(eventSkill(context)?.burst) || warriorActiveBuffStacks(context, 'burst-precision', 1) > 0
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const bloodlust = defineTrait({
  id: TRAIT.BLOODLUST,
  name: 'Bloodlust',
  balance: {
    conditionDurationBonus: 0.33,
    procRate: {
      id: 'warrior.bloodlust',
      traitId: TRAIT.BLOODLUST,
      field: 'procChance',
      opportunity: 'eligible critical hit'
    },
    procChance: 0.33,
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 }]
  },
  buildAttributes(_common, context) {
    return {
      traitDurations: {
        'Bleeding Duration':
          100 *
          balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.BLOODLUST),
            'conditionDurationBonus'
          )
      }
    };
  }
});

/** Owns this trait's tuning and selected contributions. */
export const furious = defineTrait({
  id: TRAIT.FURIOUS,
  name: 'Furious',
  balance: {
    resourceGain: 1,
    maximumStacks: 25,
    attributeBonus: 15,
    effects: [{ name: 'furious-surge', type: 'buff', kind: 'furious-surge', stacks: 1, duration: 10 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const sunderingBurst = defineTrait({
  id: TRAIT.SUNDERING_BURST,
  name: 'Sundering Burst',
  balance: {
    internalCooldown: 5,
    effects: [
      { name: 'Burst', type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 },
      { name: 'Critical burst', type: 'condition', condition: 'Vulnerability', stacks: 10, duration: 8 }
    ]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const opportunist = defineTrait({
  id: TRAIT.OPPORTUNIST,
  name: 'Opportunist',
  balance: {
    internalCooldown: 1,
    resourceGain: 5,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 3 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const furiousBurst = defineTrait({
  id: TRAIT.FURIOUS_BURST,
  name: 'Furious Burst',
  balance: {
    criticalChance: 0.05,
    internalCooldown: 4,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 2.5 }]
  },
  modifierRules: [
    {
      order: 3,
      id: 'warrior.furious-burst-fury-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FURIOUS_BURST), 'criticalChance'),
      when: (context) => warriorBoonActive(context, 'fury')
    }
  ],
  triggers: [
    {
      order: 5,

      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.inputCategory === 'weapon-swap',
      emit: TRAIT.FURIOUS_BURST,
      icd: 'profile',
      effects: (effect) => effect.type === 'boon' && effect.name === 'fury',
      attribution: { name: 'Furious Burst' }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const deepStrikes = defineTrait({
  id: TRAIT.DEEP_STRIKES,
  name: 'Deep Strikes',
  balance: {
    criticalChance: 0.05,
    attributeBonus: 180
  },
  modifierRules: [
    {
      order: 4,
      id: 'warrior.deep-strikes',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEEP_STRIKES), 'criticalChance'),
      when: (context) => targetConditionActive(context, 'Bleeding')
    }
  ],
  buildAttributes(_common, context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.DEEP_STRIKES),
            'attributeBonus'
          ),
          feedsConversions: false,
          enabled: Boolean(context.build.assumptions?.fury)
        }
      ]
    };
  }
});

/** Owns this trait's tuning and selected contributions. */
export const unsuspectingFoe = defineTrait({
  id: TRAIT.UNSUSPECTING_FOE,
  name: 'Unsuspecting Foe',
  balance: {
    criticalChance: 0.25
  },
  modifierRules: [
    {
      order: 5,
      id: 'warrior.unsuspecting-foe',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.UNSUSPECTING_FOE), 'criticalChance'),
      when: (context) => Boolean(context.config?.target?.defiant)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const woundingPrecision = defineTrait({
  id: TRAIT.WOUNDING_PRECISION,
  name: 'Wounding Precision',
  balance: { attributeConversion: 0.07 },
  buildAttributes(_common, context) {
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Precision',
          to: 'Expertise',
          multiplier: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.WOUNDING_PRECISION),
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

/** Owns this trait's tuning and selected contributions. */
export const blademaster = defineTrait({
  id: TRAIT.BLADEMASTER,
  name: 'Blademaster',
  balance: {
    rechargeMultiplier: 0.8,
    attributeBonus: 120
  },
  buildAttributes(_common, context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.BLADEMASTER),
            'attributeBonus'
          ),
          feedsConversions: false,
          enabled: true
        }
      ]
    };
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Sword',
      multiplier: { profile: TRAIT.BLADEMASTER, field: 'rechargeMultiplier' }
    }
  ]
});

/** Select measured dual wield durations for the active offhand. */
export const dualWielding = defineTrait({
  id: TRAIT.DUAL_WIELDING,
  name: 'Dual Wielding',
  hooks: {
    castDurationMs(runtime, skill, durationMs) {
      const measured = Number(skill.dualWieldCastTimeMs);
      const offhand = gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet)[1];
      return measured > 0 &&
        hasTrait(runtime, TRAIT.DUAL_WIELDING) &&
        ['Axe', 'Dagger', 'Mace', 'Sword'].includes(String(offhand))
        ? measured
        : durationMs;
    }
  }
});

type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

// Trigger Lesser Signet of Might after the first eligible below-half-health strike at that strike's exact timestamp.
export function signetMasteryDamage(
  context: MechanicContext<WarriorRuntimeState, WarriorSkill>,
  event: Gw2ResolverEvent
): void {
  if (
    event.actorType !== 'player' ||
    !((event.coefficient || 0) > 0) ||
    !context.combat.targetHealthBelow(0.5) ||
    !hasTrait(context, TRAIT.SIGNET_MASTERY)
  ) {
    return;
  }

  const signetMastery = requireBalanceProfileFromContext(context, TRAIT.SIGNET_MASTERY);
  // Reserve this trait's own deadline before emitting its effects.
  if (!context.procs.claim(TRAIT.SIGNET_MASTERY)) return;
  for (const effect of signetMastery.effects || []) {
    const kind = String(effect.boon || effect.kind || '');
    context.effects.emit({
      kind: 'packet',
      durationContext: event,
      event: buildResolverBuff({
        at: event.at,
        priority: 5,
        source: 'Trait',
        sourceId: TRAIT.SIGNET_MASTERY,
        actorType: 'effect',
        skillId: TRAIT.SIGNET_MASTERY,
        skillName: 'Lesser Signet of Might',
        kind,
        stacks: effectNumber(signetMastery, effect, 'stacks'),
        duration: effectNumber(signetMastery, effect, 'duration')
      })
    });
  }

  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Lesser Signet of Might',
      at: event.at,
      sourceSkill: event.skillName,
      detail: '10 might; Signet Mastery stack',
      icon: context.helpers.skillsById.get(ID.SIGNET_OF_MIGHT)?.icon || ''
    }
  });
}

// Resolve Arms-owned attributes, including live signet state and critical-proc stacks.
export function modifyWarriorArmsAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean
): void {
  const signetMasteryProfile = requireBalanceProfileFromContext(context, TRAIT.SIGNET_MASTERY);
  const signetStacks = warriorActiveBuffStacks(
    context,
    'signet-mastery',
    balanceProfileNumber(signetMasteryProfile, 'maximumStacks')
  );
  if (hasTrait(context, TRAIT.SIGNET_MASTERY)) {
    result.ferocity += signetStacks * balanceProfileNumber(signetMasteryProfile, 'attributeBonus');
  }

  if (
    hasTrait(context, TRAIT.DEEP_STRIKES) &&
    warriorBoonActive(context, 'fury') &&
    !(staticRulesApplied && Boolean(context.config?.boons?.fury))
  ) {
    const deepStrikesProfile = requireBalanceProfileFromContext(context, TRAIT.DEEP_STRIKES);
    result.conditionDamage += balanceProfileNumber(deepStrikesProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.BLADEMASTER) && warriorWieldingWeapon(context, 'Sword')) {
    const blademasterProfile = requireBalanceProfileFromContext(context, TRAIT.BLADEMASTER);
    result.conditionDamage += balanceProfileNumber(blademasterProfile, 'attributeBonus');
  }

  const furiousProfile = requireBalanceProfileFromContext(context, TRAIT.FURIOUS);
  result.conditionDamage +=
    warriorActiveBuffStacks(context, 'furious-surge', balanceProfileNumber(furiousProfile, 'maximumStacks')) *
    balanceProfileNumber(furiousProfile, 'attributeBonus');
  if (hasTrait(context, TRAIT.BURST_PRECISION) && warriorActiveBuffStacks(context, 'burst-precision', 1) > 0) {
    const burstPrecisionProfile = requireBalanceProfileFromContext(context, TRAIT.BURST_PRECISION);
    result.ferocity += balanceProfileNumber(burstPrecisionProfile, 'attributeBonus');
  }
}

export function claimTrait(runtime: WarriorRuntime, trait: number): boolean {
  return hasTrait(runtime, trait) && runtime.procs.claim(trait);
}

export function triggerOpportunist(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !claimTrait(runtime, TRAIT.OPPORTUNIST)) return;
  grantWarriorResource(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.OPPORTUNIST), 'resourceGain')
  );
  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.OPPORTUNIST);
    runtime.effects.emit({
      kind: 'profile',
      profile: traitProfile,
      effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.OPPORTUNIST,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      cause: event,
      transform: (packet) => ({ ...packet, priority: 5, name: traitProfile.name, stacks: 1 * Number(packet.stacks) })
    });
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function burstPrecisionHit(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  const attribution = {
    at: runtime.time,
    priority: 5,
    source: 'Trait',
    actorType: 'effect' as const,
    skillId: event.skillId,
    skillName: event.skillName,
    stacks: 1
  };
  if (hasTrait(runtime, TRAIT.BURST_PRECISION)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BURST_PRECISION);
    runtime.effects.emit({
      kind: 'packet',
      cause: event,
      event: {
        ...attribution,
        sourceId: TRAIT.BURST_PRECISION,
        type: 'buff',
        name: 'Burst Precision',
        kind: 'burst-precision',
        duration: balanceProfileNumber(
          profile,
          Number(event.metadata?.warriorAdrenalineSpent) >= 30 ? 'maximumStacks' : 'minimumStacks'
        )
      }
    });
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function armsCriticalRewards(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  opportunity: ReturnType<typeof criticalOpportunity>,
  firstBurst: boolean
): void {
  const criticals = opportunity.sampledCriticals;
  if (hasTrait(runtime, TRAIT.BLOODLUST)) {
    const proc = advanceCriticalProc(opportunity, {
      id: 'warrior.core.bloodlust',
      at: runtime.time,
      chanceOnCriticalHit: procChanceFromContext(runtime, TRAIT.BLOODLUST),
      randomStream: 'warrior.bloodlust',
      roll: (chance, stream) => runtime.random.roll(chance, stream)
    });
    if (proc) {
      const profile = requireBalanceProfileFromContext(runtime, TRAIT.BLOODLUST);
      const bleeding = requireEffect(profile, 'condition', 'Bleeding');
      if (bleeding) {
        const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BLOODLUST);
        runtime.effects.emit({
          kind: 'profile',
          profile: traitProfile,
          effects: [bleeding],
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BLOODLUST,
            actorType: 'effect',
            skillId: event.skillId,
            skillName: event.skillName
          },
          cause: event,
          transform: (packet) => ({
            ...packet,
            priority: 5,
            stacks: proc.quantity * Number(packet.stacks),
            name: 'Bloodlust \u2014 Bleeding',
            skillName: 'Bloodlust',
            triggeredBy: event.skillName,
            metadata: { procCount: proc.quantity }
          })
        });
      }
    }
  }

  if (criticals > 0 && hasTrait(runtime, TRAIT.FURIOUS)) {
    grantWarriorResource(
      runtime,
      criticals * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS), 'resourceGain')
    );
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FURIOUS,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        cause: event,
        transform: (packet) => ({
          ...packet,
          priority: 5,
          name: traitProfile.name,
          stacks: criticals * Number(packet.stacks)
        })
      });
    }
  }

  if (firstBurst && claimTrait(runtime, TRAIT.SUNDERING_BURST)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SUNDERING_BURST);
    const effect = requireEffect(profile, 'condition', criticals > 0 ? 'Critical burst' : 'Burst');
    if (effect) {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.SUNDERING_BURST);
      runtime.effects.emit({
        kind: 'profile',
        profile: traitProfile,
        effects: [effect],
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.SUNDERING_BURST,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        cause: event,
        transform: (packet) => ({
          ...packet,
          priority: 5,
          stacks: 1 * Number(packet.stacks),
          name: 'Sundering Burst — Vulnerability'
        })
      });
    }
  }
}
