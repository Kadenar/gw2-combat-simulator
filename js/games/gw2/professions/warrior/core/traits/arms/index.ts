import { WEAPON, ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';
import { skillForEvent, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';

import { warriorDualWieldingActive } from '#gw2/professions/warrior/data/dual-wielding.js';

import { emitTraitProfile, invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  attributeBonusFromContext,
  attributeBonusNumber,
  balanceNumberFromContext,
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
} from '#gw2/professions/warrior/core/mechanics/trigger-points.js';
import {
  warriorActiveBuffStacks,
  warriorBoonActive,
  warriorWieldingSword
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntime } from '#gw2/professions/warrior/types.js';

/** Owns this trait's tuning and selected contributions. */
export const signetMastery = defineTrait({
  name: 'Signet Mastery',
  id: TRAIT.SIGNET_MASTERY,
  balance: {
    threshold: 0.5,
    maximumStacks: 5,
    attributePerStack: 100,
    effects: [{ name: 'signet-mastery', type: 'buff', kind: 'signet-mastery', stacks: 1, duration: 60 }]
  },
  // Active Signet Mastery Ferocity feeds conversions; its contribution expires with the live stacks.
  attributes(context) {
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.SIGNET_MASTERY);

    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount:
            warriorActiveBuffStacks(context, 'signet-mastery', balanceProfileNumber(profile, 'maximumStacks')) *
            balanceProfileNumber(profile, 'attributePerStack'),
          feedsConversions: 'all',
          enabled: true
        }
      ]
    };
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
  name: 'Burst Precision',
  id: TRAIT.BURST_PRECISION,
  balance: {
    threshold: 30,
    criticalChance: 1,
    minimumStacks: 2,
    maximumStacks: 4,
    attributeBonuses: { ferocity: 250 }
  },
  // The accepted Burst Precision window supplies conversion-eligible Ferocity until it expires.
  attributes(context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: attributeBonusFromContext(context.balanceContext, TRAIT.BURST_PRECISION, 'ferocity'),
          feedsConversions: 'all',
          enabled: warriorActiveBuffStacks(context, 'burst-precision', 1) > 0
        }
      ]
    };
  },
  modifierRules: [
    {
      order: 6,
      id: 'warrior.burst-precision',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.BURST_PRECISION, 'criticalChance'),
      when: (context) =>
        Boolean(skillForEvent(context.profession?.catalog, context.event, context.skillId)?.burst) ||
        warriorActiveBuffStacks(context, 'burst-precision', 1) > 0
    }
  ],
  triggers: [
    onTriggerPoint(burstFirstHit, {
      run: (runtime, input: TriggerPointInput<typeof burstFirstHit>) => burstPrecisionHit(runtime, input.event)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const bloodlust = defineTrait({
  name: 'Bloodlust',
  id: TRAIT.BLOODLUST,
  balance: {
    conditionDurationBonus: 0.33,
    procRate: {
      id: 'warrior.bloodlust',
      traitId: TRAIT.BLOODLUST,
      field: 'procChance',
      opportunity: 'eligible critical hit'
    },
    procChance: 0.33,
    effects: [{ name: CONDITION.BLEEDING, type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 }]
  },
  attributes(context) {
    return {
      traitDurations: {
        'Bleeding Duration':
          100 * balanceNumberFromContext(context.balanceContext, TRAIT.BLOODLUST, 'conditionDurationBonus')
      }
    };
  },
  triggers: [
    onTriggerPoint(critical, {
      run: (runtime, input: TriggerPointInput<typeof critical>) =>
        bloodlustCritical(runtime, input.event, input.opportunity)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const furious = defineTrait({
  name: 'Furious',
  id: TRAIT.FURIOUS,
  balance: {
    resourceGain: 1,
    maximumStacks: 25,
    attributePerStack: 15,
    effects: [{ name: 'furious-surge', type: 'buff', kind: 'furious-surge', stacks: 1, duration: 10 }]
  },
  // Count only accepted self stacks; deselection stops future grants, not existing ones.
  grantedAttributes(context) {
    if (!context.runtime && !context.timeline) return {};

    const profile = requireBalanceProfileFromContext(context, TRAIT.FURIOUS);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          feedsConversions: 'none',
          amount:
            warriorActiveBuffStacks(context, 'furious-surge', balanceProfileNumber(profile, 'maximumStacks')) *
            balanceProfileNumber(profile, 'attributePerStack')
        }
      ]
    };
  },
  triggers: [
    onTriggerPoint(critical, {
      run: (runtime, input: TriggerPointInput<typeof critical>) =>
        furiousCritical(runtime, input.event, input.opportunity)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const sunderingBurst = defineTrait({
  name: 'Sundering Burst',
  id: TRAIT.SUNDERING_BURST,
  balance: {
    internalCooldown: 5,
    effects: [
      { name: 'Burst', type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 8 },
      { name: 'Critical burst', type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 10, duration: 8 }
    ]
  },
  triggers: [
    onTriggerPoint(critical, {
      run: (runtime, input: TriggerPointInput<typeof critical>) =>
        sunderingBurstCritical(runtime, input.event, input.opportunity, input.firstBurst)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const opportunist = defineTrait({
  name: 'Opportunist',
  id: TRAIT.OPPORTUNIST,
  balance: {
    internalCooldown: 1,
    resourceGain: 5,
    effects: [{ name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, stacks: 1, duration: 3 }]
  },
  triggers: [
    onTriggerPoint(immobilized, {
      run: (runtime, input: TriggerPointInput<typeof immobilized>) => triggerOpportunist(runtime, input.event)
    }),
    onTriggerPoint(controlAccepted, {
      run: (runtime, input: TriggerPointInput<typeof controlAccepted>) => triggerOpportunist(runtime, input.event)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const furiousBurst = defineTrait({
  name: 'Furious Burst',
  id: TRAIT.FURIOUS_BURST,
  balance: {
    criticalChance: 0.05,
    internalCooldown: 4,
    effects: [{ name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, stacks: 1, duration: 2.5 }]
  },
  modifierRules: [
    {
      order: 3,
      id: 'warrior.furious-burst-fury-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.FURIOUS_BURST, 'criticalChance'),
      when: (context) => warriorBoonActive(context, boonKey(BOON.FURY))
    }
  ],
  triggers: [
    {
      order: 5,

      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.inputCategory === 'weapon-swap',
      emit: TRAIT.FURIOUS_BURST,
      cooldown: 'profile',
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.FURY),
      attribution: { name: 'Furious Burst' }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const deepStrikes = defineTrait({
  name: 'Deep Strikes',
  id: TRAIT.DEEP_STRIKES,
  balance: {
    criticalChance: 0.05,
    attributeBonuses: { conditionDamage: 180 }
  },
  attributes(context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: attributeBonusFromContext(context.balanceContext, TRAIT.DEEP_STRIKES, 'conditionDamage'),
          feedsConversions: 'none',
          enabled: Boolean(context.loadout.assumptions.fury)
        }
      ]
    };
  },
  modifierRules: [
    {
      order: 4,
      id: 'warrior.deep-strikes',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.DEEP_STRIKES, 'criticalChance'),
      when: (context) => targetConditionActive(context, CONDITION.BLEEDING)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const unsuspectingFoe = defineTrait({
  name: 'Unsuspecting Foe',
  id: TRAIT.UNSUSPECTING_FOE,
  balance: {
    criticalChance: 0.25
  },
  modifierRules: [
    {
      order: 5,
      id: 'warrior.unsuspecting-foe',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.UNSUSPECTING_FOE, 'criticalChance'),
      when: (context) => Boolean(context.config?.target?.defiant)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const woundingPrecision = defineTrait({
  name: 'Wounding Precision',
  id: TRAIT.WOUNDING_PRECISION,
  balance: { attributeConversion: 0.07 },
  attributes(context) {
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Precision',
          to: 'Expertise',
          multiplier: balanceNumberFromContext(context.balanceContext, TRAIT.WOUNDING_PRECISION, 'attributeConversion'),
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
  name: 'Blademaster',
  id: TRAIT.BLADEMASTER,
  balance: {
    rechargeMultiplier: 0.8,
    attributeBonuses: { expertise: 120, conditionDamage: 120 }
  },
  // Declare both the permanent Expertise and weapon-dependent Condition Damage together.
  attributes(context) {
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.BLADEMASTER);

    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: attributeBonusNumber(profile, 'expertise'),
          // Permanent Expertise feeds utility conversions even when no sword is equipped.
          feedsConversions: 'all',
          enabled: true
        },
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: attributeBonusNumber(profile, 'conditionDamage'),
          // The sword bonus joins conversion inputs only while its weapon requirement is satisfied.
          feedsConversions: 'all',
          enabled: warriorWieldingSword(context)
        }
      ]
    };
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === WEAPON.SWORD,
      multiplier: { profile: TRAIT.BLADEMASTER, field: 'rechargeMultiplier' }
    }
  ]
});

/** Select measured dual wield durations for the active offhand. */
export const dualWielding = defineTrait({
  name: 'Dual Wielding',
  id: TRAIT.DUAL_WIELDING,
  hooks: {
    castDurationMs(runtime, skill, durationMs) {
      const measured = Number(skill.dualWieldCastTimeMs);
      return measured > 0 && warriorDualWieldingActive(runtime.config, runtime.activeWeaponSet) ? measured : durationMs;
    }
  }
});

// Trigger Lesser Signet of Might after the first eligible below-half-health strike at that strike's exact timestamp.
function signetMasteryDamage(context: WarriorRuntime, event: Gw2ResolverEvent): void {
  // The trait retains its threshold and stacking attribute reward; the lesser signet owns Might and recharge.
  if (
    event.actorType !== ACTOR.PLAYER ||
    !(Number(event.coefficient) > 0) ||
    !context.combat.targetHealthBelow(balanceNumberFromContext(context, TRAIT.SIGNET_MASTERY, 'threshold'))
  )
    return;

  const skill = context.helpers.skillsById.get(ID.LESSER_SIGNET_OF_MIGHT)!;

  if (context.cooldownController.isOnCooldown(skill.id, context.time)) return;

  context.cooldownController.startRecharge(skill, context.time);
  invokeTraitSkill(context, TRAIT.SIGNET_MASTERY, skill.id, event, {
    announce: true,
    detail: `${requireEffect(skill, 'boon', boonKey(BOON.MIGHT))?.stacks ?? 0} might; Signet Mastery stack`,
    attribution: { priority: 5 }
  });
  emitTraitProfile(context, TRAIT.SIGNET_MASTERY, TRAIT.SIGNET_MASTERY, event, {
    effect: { type: 'buff', name: 'signet-mastery' },
    skillId: skill.id,
    skillName: skill.name,
    attribution: { priority: 5, name: skill.name, triggeredBy: event.skillName }
  });
}

function triggerOpportunist(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== ACTOR.PLAYER || !runtime.procs.claim(TRAIT.OPPORTUNIST)) return;

  grantWarriorResource(runtime, balanceNumberFromContext(runtime, TRAIT.OPPORTUNIST, 'resourceGain'));
  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.OPPORTUNIST);
    emitTraitProfile(runtime, TRAIT.OPPORTUNIST, TRAIT.OPPORTUNIST, event, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.OPPORTUNIST,
        actorType: ACTOR.EFFECT,
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
    actorType: ACTOR.EFFECT,
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
  opportunity: ReturnType<typeof criticalOpportunity>
): void {
  const proc = advanceCriticalProc(opportunity, {
    id: 'warrior.core.bloodlust',
    at: runtime.time,
    chanceOnCriticalHit: procChanceFromContext(runtime, TRAIT.BLOODLUST),
    randomStream: 'warrior.bloodlust',
    roll: (chance, stream) => runtime.random.roll(chance, stream)
  });

  if (proc) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BLOODLUST);
    const bleeding = requireEffect(profile, 'condition', CONDITION.BLEEDING);

    if (bleeding) {
      emitTraitProfile(runtime, TRAIT.BLOODLUST, TRAIT.BLOODLUST, event, {
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.BLOODLUST,
          actorType: ACTOR.EFFECT,
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

/** Resolve this trait's reward from the shared critical opportunity. */
function furiousCritical(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  opportunity: ReturnType<typeof criticalOpportunity>
): void {
  const criticals = opportunity.sampledCriticals;

  if (criticals > 0) {
    grantWarriorResource(runtime, criticals * balanceNumberFromContext(runtime, TRAIT.FURIOUS, 'resourceGain'));
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS);
      emitTraitProfile(runtime, TRAIT.FURIOUS, TRAIT.FURIOUS, event, {
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FURIOUS,
          actorType: ACTOR.EFFECT,
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
          actorType: ACTOR.EFFECT,
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
