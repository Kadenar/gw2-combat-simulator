import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';
import { skillForEvent, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';

import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  burstFirstHit,
  controlAccepted,
  critical,
  immobilized,
  strikeResourcesGranted
} from '#gw2/professions/warrior/core/mechanics/combat.js';
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
  // Read live signet stacks without adding their Ferocity to ordinary conversion inputs.
  attributes(context) {
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.SIGNET_MASTERY);

    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount:
            warriorActiveBuffStacks(context, 'signet-mastery', balanceProfileNumber(profile, 'maximumStacks')) *
            balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
          enabled: true
        }
      ]
    };
  },

  id: TRAIT.SIGNET_MASTERY,
  name: 'Signet Mastery',
  balance: {
    threshold: 0.5,
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
    cooldown: 20,
    maximumStacks: 5,
    attributeBonus: 100,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 10, duration: 6 },
      { name: 'signet-mastery', type: 'buff', kind: 'signet-mastery', stacks: 1, duration: 60 }
    ]
  },
  triggers: [
    onTriggerPoint(strikeResourcesGranted, {
      run: (runtime, input: TriggerPointInput<typeof strikeResourcesGranted>) =>
        signetMasteryDamage(runtime, input.event)
    }),
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
  // The accepted Burst Precision window controls its flat Ferocity.
  attributes(context) {
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.BURST_PRECISION);

    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
          enabled: warriorActiveBuffStacks(context, 'burst-precision', 1) > 0
        }
      ]
    };
  },

  triggers: [
    onTriggerPoint(burstFirstHit, {
      run: (runtime, input: TriggerPointInput<typeof burstFirstHit>) => burstPrecisionHit(runtime, input.event)
    })
  ],
  id: TRAIT.BURST_PRECISION,
  name: 'Burst Precision',
  balance: {
    threshold: 30,
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
        Boolean(skillForEvent(context.profession?.catalog, context.event, context.skillId)?.burst) ||
        warriorActiveBuffStacks(context, 'burst-precision', 1) > 0
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const bloodlust = defineTrait({
  triggers: [
    onTriggerPoint(critical, {
      run: (runtime, input: TriggerPointInput<typeof critical>) =>
        bloodlustCritical(runtime, input.event, input.opportunity, input.firstBurst)
    })
  ],
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
  attributes(context) {
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
  triggers: [
    onTriggerPoint(critical, {
      run: (runtime, input: TriggerPointInput<typeof critical>) =>
        furiousCritical(runtime, input.event, input.opportunity, input.firstBurst)
    })
  ],
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
  triggers: [
    onTriggerPoint(critical, {
      run: (runtime, input: TriggerPointInput<typeof critical>) =>
        sunderingBurstCritical(runtime, input.event, input.opportunity, input.firstBurst)
    })
  ],
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
  triggers: [
    onTriggerPoint(immobilized, {
      run: (runtime, input: TriggerPointInput<typeof immobilized>) => triggerOpportunist(runtime, input.event)
    }),
    onTriggerPoint(controlAccepted, {
      run: (runtime, input: TriggerPointInput<typeof controlAccepted>) => triggerOpportunist(runtime, input.event)
    })
  ],
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
      cooldown: 'profile',
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
  attributes(context) {
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
          enabled: Boolean(context.loadout.assumptions.fury)
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
  attributes(context) {
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
  // Declare both the permanent Expertise and weapon-dependent Condition Damage together.
  attributes(context) {
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.BLADEMASTER);

    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
          enabled: true
        },
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
          enabled: warriorWieldingWeapon(context, 'Sword')
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
function signetMasteryDamage(
  context: MechanicContext<WarriorRuntimeState, WarriorSkill>,
  event: Gw2ResolverEvent
): void {
  if (
    event.actorType !== 'player' ||
    !((event.coefficient || 0) > 0) ||
    !context.combat.targetHealthBelow(
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SIGNET_MASTERY), 'threshold')
    )
  ) {
    return;
  }

  // Reserve this trait's own deadline before emitting its effects.
  if (!context.procs.claim(TRAIT.SIGNET_MASTERY)) return;
  // The claim owns the whole lesser signet; the shared emitter expands its current buff package.
  emitTraitProfile(context, TRAIT.SIGNET_MASTERY, TRAIT.SIGNET_MASTERY, undefined, {
    at: event.at,
    durationContext: event,
    effects: (effect) => effect.type === 'boon' || effect.type === 'buff',
    attribution: {
      priority: 5,
      skillId: TRAIT.SIGNET_MASTERY,
      skillName: 'Lesser Signet of Might',
      name: 'Lesser Signet of Might'
    }
  });

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

/** Granted Furious Surge stacks retain their bonus independently of current trait selection. */
export function modifyWarriorArmsAttributes(context: Gw2ModifierContext, result: WarriorModifierAttributes): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.FURIOUS);
  result.conditionDamage +=
    warriorActiveBuffStacks(context, 'furious-surge', balanceProfileNumber(profile, 'maximumStacks')) *
    balanceProfileNumber(profile, 'attributeBonus');
}

function triggerOpportunist(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !runtime.procs.claim(TRAIT.OPPORTUNIST)) return;
  grantWarriorResource(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.OPPORTUNIST), 'resourceGain')
  );
  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.OPPORTUNIST);
    emitTraitProfile(runtime, TRAIT.OPPORTUNIST, TRAIT.OPPORTUNIST, event, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.OPPORTUNIST,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      transform: (packet) => ({ ...packet, priority: 5, name: traitProfile.name, stacks: 1 * Number(packet.stacks) }),
      effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type)
    });
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
function burstPrecisionHit(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  const attribution = {
    at: runtime.time,
    priority: 5,
    source: 'Trait',
    actorType: 'effect' as const,
    skillId: event.skillId,
    skillName: event.skillName,
    stacks: 1
  };
  {
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
          Number(event.metadata?.warriorAdrenalineSpent) >= balanceProfileNumber(profile, 'threshold')
            ? 'maximumStacks'
            : 'minimumStacks'
        )
      }
    });
  }
}

/** Resolve this trait's reward from the shared critical opportunity. */
function bloodlustCritical(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  opportunity: ReturnType<typeof criticalOpportunity>,
  _firstBurst: boolean
): void {
  {
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
        emitTraitProfile(runtime, TRAIT.BLOODLUST, TRAIT.BLOODLUST, event, {
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BLOODLUST,
            actorType: 'effect',
            skillId: event.skillId,
            skillName: event.skillName
          },
          transform: (packet) => ({
            ...packet,
            priority: 5,
            stacks: proc.quantity * Number(packet.stacks),
            name: 'Bloodlust \u2014 Bleeding',
            skillName: 'Bloodlust',
            triggeredBy: event.skillName,
            metadata: { procCount: proc.quantity }
          }),
          effects: (candidate) => candidate === bleeding
        });
      }
    }
  }
}

/** Resolve this trait's reward from the shared critical opportunity. */
function furiousCritical(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  opportunity: ReturnType<typeof criticalOpportunity>,
  _firstBurst: boolean
): void {
  const criticals = opportunity.sampledCriticals;
  if (criticals > 0) {
    grantWarriorResource(
      runtime,
      criticals * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS), 'resourceGain')
    );
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS);
      emitTraitProfile(runtime, TRAIT.FURIOUS, TRAIT.FURIOUS, event, {
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FURIOUS,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        transform: (packet) => ({
          ...packet,
          priority: 5,
          name: traitProfile.name,
          stacks: criticals * Number(packet.stacks)
        }),
        effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type)
      });
    }
  }
}

/** Resolve this trait's reward from the shared critical opportunity. */
function sunderingBurstCritical(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  opportunity: ReturnType<typeof criticalOpportunity>,
  firstBurst: boolean
): void {
  const criticals = opportunity.sampledCriticals;
  if (firstBurst && runtime.procs.claim(TRAIT.SUNDERING_BURST)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SUNDERING_BURST);
    const effect = requireEffect(profile, 'condition', criticals > 0 ? 'Critical burst' : 'Burst');
    if (effect) {
      emitTraitProfile(runtime, TRAIT.SUNDERING_BURST, TRAIT.SUNDERING_BURST, event, {
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.SUNDERING_BURST,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        transform: (packet) => ({
          ...packet,
          priority: 5,
          stacks: 1 * Number(packet.stacks),
          name: 'Sundering Burst — Vulnerability'
        }),
        effects: (candidate) => candidate === effect
      });
    }
  }
}
