// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent, targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { ACTOR, BOON, CONDITION, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import {
  defineTrait,
  traitAttributeEffects,
  traitSkillReplacement
} from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { transfer } from '#gw2/professions/necromancer/core/mechanics/condition-management.js';
import { shroudEntered, shroudEntering, shroudInvoked } from '#gw2/professions/necromancer/core/mechanics/forms.js';
import {
  necromancerConditionApplied,
  necromancerControlAccepted,
  necromancerStrike,
  necromancerStrikePreparing
} from '#gw2/professions/necromancer/core/mechanics/trigger-points.js';
import { emitShroudEntryTrait } from '#gw2/professions/necromancer/core/traits/shroud-entry.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime
} from '#gw2/professions/necromancer/types.js';

/** Owns Barbed Precision tuning and behavior at its existing execution boundaries. */
export const barbedPrecision = defineTrait({
  name: 'Barbed Precision',
  id: TRAIT.BARBED_PRECISION,
  balance: {
    conditionDurationMultiplier: 1.2,
    procRate: {
      id: 'necromancer.barbed-precision',
      traitId: TRAIT.BARBED_PRECISION,
      field: 'criticalChance',
      opportunity: 'eligible critical hit'
    },
    criticalChance: 0.33,
    effects: [
      {
        name: CONDITION.BLEEDING,
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  attributes: ({ balanceContext: profileContext }) => ({
    traitDurations: {
      'Bleeding Duration':
        balanceNumberFromContext(profileContext, TRAIT.BARBED_PRECISION, 'conditionDurationMultiplier') * 100 - 100
    }
  }),
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== ACTOR.EFFECT && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        necromancerBarbedPrecisionReaction(runtime, input.event, input.details)
    })
  ]
});

/** Owns Chilling Darkness tuning and behavior at its existing execution boundaries. */
export const chillingDarkness = defineTrait({
  name: 'Chilling Darkness',
  id: TRAIT.CHILLING_DARKNESS,
  balance: {
    cooldown: 3,
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
    onTriggerPoint(necromancerConditionApplied, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        input.event.condition === CONDITION.BLINDNESS,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyChillingDarkness(runtime, input.event)
    })
  ]
});

/** Owns Insidious Disruption tuning and behavior at its existing execution boundaries. */
export const insidiousDisruption = defineTrait({
  name: 'Insidious Disruption',
  id: TRAIT.INSIDIOUS_DISRUPTION,
  balance: {
    effects: [
      {
        name: CONDITION.TORMENT,
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  triggers: [
    onTriggerPoint(necromancerControlAccepted, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerControlAccepted>) =>
        applyInsidiousDisruption(runtime, input.event)
    }),
    onTriggerPoint(necromancerConditionApplied, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        input.event.condition === CONDITION.FEAR,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyInsidiousDisruption(runtime, input.event)
    })
  ]
});

/** Owns Furious Demise tuning and behavior at its existing execution boundaries. */
export const furiousDemise = defineTrait({
  name: 'Furious Demise',
  id: TRAIT.FURIOUS_DEMISE,
  balance: {
    attributeBonuses: { precision: 180 },
    effects: [
      {
        name: boonKey(BOON.FURY),
        type: 'boon',
        boon: BOON.FURY,
        stacks: 1,
        duration: 8,
        packetLabel: 'on shroud entry'
      }
    ]
  },
  attributes: traitAttributeEffects(TRAIT.FURIOUS_DEMISE, [
    // Target the Weak explicitly converts this Precision; utility consumables do not.
    { kind: 'flat', to: 'Precision', feedsConversions: 'profession-only' }
  ]),
  triggers: [
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        emitShroudEntryTrait(runtime, input.cast, TRAIT.FURIOUS_DEMISE)
    })
  ]
});

/** Owns Target the Weak tuning and behavior at its existing execution boundaries. */
export const targetTheWeak = defineTrait({
  name: 'Target the Weak',
  id: TRAIT.TARGET_THE_WEAK,
  balance: {
    criticalChancePerCondition: 0.02,
    maximumConditions: CANONICAL_TARGET_CONDITIONS.length,
    attributeConversion: 0.13
  },
  attributes: traitAttributeEffects(TRAIT.TARGET_THE_WEAK, [
    {
      kind: 'conversion',
      from: 'Precision',
      to: 'Condition Damage',
      field: 'attributeConversion',
      rounding: 'floor',
      input: 'eligible'
    }
  ]),
  modifierRules: [
    {
      order: -19,
      id: 'necromancer.target-the-weak-critical-chance',
      label: 'Target the Weak',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => {
        // Critical chance counts distinct conditions only up to the selected trait profile's cap.
        const profile = requireBalanceProfileFromContext(context, TRAIT.TARGET_THE_WEAK);
        return (
          Math.min(targetConditionCount(context), balanceProfileNumber(profile, 'maximumConditions')) *
          balanceProfileNumber(profile, 'criticalChancePerCondition')
        );
      }
    }
  ]
});

/** Owns Lingering Curse tuning and behavior at its existing execution boundaries. */
export const lingeringCurse = defineTrait({
  name: 'Lingering Curse',
  id: TRAIT.LINGERING_CURSE,
  balance: {
    attributeBonuses: { conditionDamage: 200 },
    durationMultiplier: 1.5
  },
  attributes: traitAttributeEffects(TRAIT.LINGERING_CURSE, [
    { kind: 'flat', to: 'Condition Damage', feedsConversions: 'none' }
  ]),
  // Scale eligible Scepter base durations before ordinary duration bonuses and their cap.
  modifierRules: [
    {
      id: 'necromancer.lingering-curse-duration',
      target: MODIFIER_TARGET.CONDITION_BASE_DURATION,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.LINGERING_CURSE, 'durationMultiplier'),
      when: (context) =>
        skillForEvent(context.profession?.catalog, context.event, context.skillId)?.weapon === WEAPON.SCEPTER &&
        context.event?.skillId !== ID.DEVOURING_DARKNESS
    }
  ],
  // Scepter 3 resolves to the selected variant, so saved rotations survive trait edits.
  hooks: {
    modifySkillId: traitSkillReplacement(TRAIT.LINGERING_CURSE, [[ID.FEAST_OF_CORRUPTION, ID.DEVOURING_DARKNESS]])
  }
});

/** Owns Weakening Shroud tuning and behavior at its existing execution boundaries. */
export const weakeningShroud = defineTrait({
  name: 'Weakening Shroud',
  id: TRAIT.WEAKENING_SHROUD,
  balance: {
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 1.5, hits: 1 },
      { name: CONDITION.BLEEDING, type: 'condition', condition: CONDITION.BLEEDING, stacks: 2, duration: 10 },
      { name: CONDITION.WEAKNESS, type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 6 }
    ]
  },
  triggers: [
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        emitShroudEntryTrait(runtime, input.cast, TRAIT.WEAKENING_SHROUD)
    })
  ]
});

/** Owns Master of Corruption tuning and behavior at its existing execution boundaries. */
export const masterOfCorruption = defineTrait({
  name: 'Master of Corruption',
  id: TRAIT.MASTER_OF_CORRUPTION,
  balance: {
    rechargeMultiplier: 0.67,
    effects: [
      {
        name: 'Self Torment',
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 2,
        duration: 10,
        target: RECIPIENT.SELF,
        metadata: { trigger: String(ID.BLOOD_IS_POWER) },
        packetLabel: 'additional with Master of Corruption'
      },
      {
        name: 'Master of Corruption Vulnerability',
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 4,
        target: RECIPIENT.SELF,
        metadata: { trigger: String(ID.CONSUME_CONDITIONS) },
        packetLabel: 'additional with Master of Corruption'
      },
      {
        name: 'Self Poisoned',
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 4,
        target: RECIPIENT.SELF,
        metadata: { trigger: String(ID.PLAGUELANDS) },
        packetLabel: 'additional with Master of Corruption'
      },
      {
        name: 'Self Crippled',
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2,
        target: RECIPIENT.SELF,
        metadata: { trigger: String(ID.CORROSIVE_POISON_CLOUD) },
        packetLabel: 'additional with Master of Corruption'
      }
    ]
  },
  rechargeRules: [
    {
      order: 0,

      when: (_runtime, skill) => Boolean(skill.categories?.includes('Corruption')),
      multiplier: { profile: TRAIT.MASTER_OF_CORRUPTION, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Plague Sending tuning and behavior at its existing execution boundaries. */
export const plagueSending = defineTrait({
  name: 'Plague Sending',
  id: TRAIT.PLAGUE_SENDING,
  balance: { maximumConditions: 2 },
  triggers: [
    onTriggerPoint(shroudInvoked, { run: armScourgePlagueSending }),
    onTriggerPoint(shroudEntering, {
      run: (runtime: NecromancerRuntime) => armPlagueSending(runtime, runtime.profession.core.selfConditions.length > 0)
    }),
    onTriggerPoint(necromancerStrikePreparing, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrikePreparing>) =>
        reactToNecromancerConditions(runtime, input.event)
    })
  ]
});

/** Terror adds damage to the skill's Fear application without creating another condition or control reaction. */
export const terror = defineTrait({
  name: 'Terror',
  id: TRAIT.TERROR,
  // The owning trait supplies tuning to its runtime consumers.
  balance: { conditionBaseDamage: 444, conditionDamageScaling: 0.4 },
  hooks: {
    prepareEvent: (runtime, event) =>
      event.type === 'condition' && event.condition === CONDITION.FEAR && hasTrait(runtime, TRAIT.TERROR)
        ? {
            ...event,
            conditionDamageFormula: {
              base: balanceNumberFromContext(runtime, TRAIT.TERROR, 'conditionBaseDamage'),
              scaling: balanceNumberFromContext(runtime, TRAIT.TERROR, 'conditionDamageScaling')
            }
          }
        : event
  }
});

/** Lets player and Ritualist spirit critical hits advance Barbed Precision, while excluding minions. */
const necromancerBarbedPrecisionReaction = criticalProcHandler<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'necromancer.barbed-precision',
  actorTypes: [ACTOR.PLAYER, ACTOR.SUMMON, ACTOR.UNKNOWN],
  chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.BARBED_PRECISION),
  randomStream: 'necromancer.barbed-precision',
  when: (_context, event) =>
    Number(event.coefficient) > 0 && (event.actorType !== ACTOR.SUMMON || event.summonKind === 'spirit'),
  handler: (context, event, _details, application) => {
    // Barbed Precision emits one condition application per threshold proc.
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const profile = requireBalanceProfileFromContext(context, TRAIT.BARBED_PRECISION);
      const effect = requireEffect(profile, 'condition', CONDITION.BLEEDING);

      if (!effect) return;

      /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
        context,
        TRAIT.BARBED_PRECISION,
        TRAIT.BARBED_PRECISION,
        undefined,
        {
          at: event.at,
          fullEnd: event.at,
          effect: { type: 'condition', name: CONDITION.BLEEDING },
          settlement: 'reaction',
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BARBED_PRECISION,
            actorType: ACTOR.EFFECT,
            skillName: 'Barbed Precision',
            triggeredBy: event.skillName,
            ownerActorType: ACTOR.PLAYER,
            name: 'Barbed Precision' + ' - ' + String(effect.condition),
            metadata: { procCount: 1 }
          }
        }
      );
      context.effects.emit({
        kind: 'announcement',
        announcement: { type: 'trait', name: 'Barbed Precision', at: event.at, sourceSkill: event.skillName }
      });
    }
  }
});

function applyChillingDarkness(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILLING_DARKNESS);
  const effect = requireEffect(profile, 'condition', CONDITION.CHILLED);

  // Claim only after local eligibility, before conditions, resources or queued strikes; the cooldown gates only
  // Chill, so a removed packet leaves it ready.
  if (!effect || !context.procs.claimCooldown('chillingDarkness', event.at, balanceProfileNumber(profile, 'cooldown')))
    return;

  /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
    context,
    TRAIT.CHILLING_DARKNESS,
    TRAIT.CHILLING_DARKNESS,
    undefined,
    {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: CONDITION.CHILLED },
      settlement: 'reaction',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.CHILLING_DARKNESS,
        actorType: ACTOR.EFFECT,
        skillName: 'Chilling Darkness',
        triggeredBy: event.skillName,
        ownerActorType: ACTOR.PLAYER,
        name: 'Chilling Darkness' + ' - ' + effect.condition || CONDITION.CHILLED
      }
    }
  );
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Chilling Darkness', at: event.at, sourceSkill: event.skillName }
  });
}

function applyInsidiousDisruption(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.INSIDIOUS_DISRUPTION);
  const effect = requireEffect(profile, 'condition', CONDITION.TORMENT);

  if (!effect) return;

  /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
    context,
    TRAIT.INSIDIOUS_DISRUPTION,
    TRAIT.INSIDIOUS_DISRUPTION,
    undefined,
    {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: CONDITION.TORMENT },
      settlement: 'reaction',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.INSIDIOUS_DISRUPTION,
        actorType: ACTOR.EFFECT,
        skillName: 'Insidious Disruption',
        triggeredBy: event.skillName,
        ownerActorType: ACTOR.PLAYER,
        name: 'Insidious Disruption' + ' - ' + String(effect.condition)
      }
    }
  );
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Insidious Disruption', at: event.at, sourceSkill: event.skillName }
  });
}

/** Shroud variants decide when to arm; the trait owns selection while a granted transfer survives until consumed. */
function armPlagueSending(runtime: NecromancerRuntime, hasConditions: boolean): void {
  runtime.profession.core.plagueSendingArmed = hasConditions;
}

function reactToNecromancerConditions(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== ACTOR.PLAYER || !(Number(event.coefficient) > 0)) return;

  const skill = skillForEvent(runtime.helpers, event);

  if (!skill) return;

  const work = { skillId: skill.id, activationId: event.activationId };
  const state = runtime.profession.core;

  if (
    state.plagueSendingArmed &&
    transfer(runtime, skill, balanceNumberFromContext(runtime, TRAIT.PLAGUE_SENDING, 'maximumConditions'), work, true)
  ) {
    state.plagueSendingArmed = false;
  }
}

/** Scourge shroud-like casts arm the existing transfer without resetting an already armed unselected grant. */
function armScourgePlagueSending(runtime: NecromancerRuntime): void {
  runtime.profession.core.plagueSendingArmed = true;
}
