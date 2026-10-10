import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent, targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  necromancerConditionApplied,
  necromancerControlAccepted,
  necromancerStrike,
  necromancerStrikePreparing
} from '#gw2/professions/necromancer/core/mechanics/combat-boundaries.js';
import { transfer } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { shroudEntered, shroudEntering, shroudInvoked } from '#gw2/professions/necromancer/core/mechanics/forms.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Owns Barbed Precision tuning and behavior at its existing execution boundaries. */
export const barbedPrecision = defineTrait({
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== 'effect' && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        necromancerBarbedPrecisionReaction(runtime, input.event, input.details)
    })
  ],
  id: TRAIT.BARBED_PRECISION,
  name: 'Barbed Precision',
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
        name: 'Bleeding',
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'effect'
      }
    ]
  },
  modifierRules: [
    {
      order: -9,
      id: 'necromancer.barbed-precision-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.BARBED_PRECISION),
          'conditionDurationMultiplier'
        ),
      when: (context) => context.condition === 'Bleeding' && !professionStaticRulesApplied(context.config)
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext }) => ({
    traitDurations: {
      'Bleeding Duration':
        balanceProfileNumber(
          requireBalanceProfileFromContext(profileContext, TRAIT.BARBED_PRECISION),
          'conditionDurationMultiplier'
        ) *
          100 -
        100
    }
  })
});

/** Owns Chilling Darkness tuning and behavior at its existing execution boundaries. */
export const chillingDarkness = defineTrait({
  triggers: [
    onTriggerPoint(necromancerConditionApplied, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        input.event.condition === 'Blindness',
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyChillingDarkness(runtime, input.event)
    })
  ],
  id: TRAIT.CHILLING_DARKNESS,
  name: 'Chilling Darkness',
  balance: {
    cooldown: 3,
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
  }
});

/** Owns Insidious Disruption tuning and behavior at its existing execution boundaries. */
export const insidiousDisruption = defineTrait({
  triggers: [
    onTriggerPoint(necromancerControlAccepted, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerControlAccepted>) =>
        applyInsidiousDisruption(runtime, input.event)
    }),
    onTriggerPoint(necromancerConditionApplied, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        input.event.condition === 'Fear',
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyInsidiousDisruption(runtime, input.event)
    })
  ],
  id: TRAIT.INSIDIOUS_DISRUPTION,
  name: 'Insidious Disruption',
  balance: {
    effects: [
      {
        name: 'Torment',
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 5,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Furious Demise tuning and behavior at its existing execution boundaries. */
export const furiousDemise = defineTrait({
  triggers: [
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        enterFuriousDemise(runtime, input.cast)
    })
  ],
  id: TRAIT.FURIOUS_DEMISE,
  name: 'Furious Demise',
  balance: {
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 8, packetLabel: 'on shroud entry' }],
    attributeBonus: 180
  },
  buildAttributes: traitAttributeEffects(TRAIT.FURIOUS_DEMISE, [
    { kind: 'flat', to: 'Precision', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns Target the Weak tuning and behavior at its existing execution boundaries. */
export const targetTheWeak = defineTrait({
  id: TRAIT.TARGET_THE_WEAK,
  name: 'Target the Weak',
  balance: {
    criticalChancePerCondition: 0.02,
    maximumConditions: CANONICAL_TARGET_CONDITIONS.length,
    attributeConversion: 0.13
  },
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
  ],
  buildAttributes: traitAttributeEffects(TRAIT.TARGET_THE_WEAK, [
    {
      kind: 'conversion',
      from: 'Precision',
      to: 'Condition Damage',
      field: 'attributeConversion',
      rounding: 'floor',
      input: 'eligible'
    }
  ])
});

/** Owns Lingering Curse tuning and behavior at its existing execution boundaries. */
export const lingeringCurse = defineTrait({
  id: TRAIT.LINGERING_CURSE,
  name: 'Lingering Curse',
  balance: {
    attributeBonus: 200,
    durationMultiplier: 1.5
  },
  buildAttributes: traitAttributeEffects(TRAIT.LINGERING_CURSE, [
    { kind: 'flat', to: 'Condition Damage', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Weakening Shroud tuning and behavior at its existing execution boundaries. */
export const weakeningShroud = defineTrait({
  triggers: [
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        enterWeakeningShroud(runtime, input.cast)
    })
  ],
  id: TRAIT.WEAKENING_SHROUD,
  name: 'Weakening Shroud',
  balance: {
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 1.5, hits: 1 },
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 2, duration: 10 },
      { name: 'Weakness', type: 'condition', condition: 'Weakness', stacks: 1, duration: 6 }
    ]
  }
});

/** Owns Master of Corruption tuning and behavior at its existing execution boundaries. */
export const masterOfCorruption = defineTrait({
  id: TRAIT.MASTER_OF_CORRUPTION,
  name: 'Master of Corruption',
  balance: { rechargeMultiplier: 0.67 },
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
  triggers: [
    onTriggerPoint(shroudInvoked, { run: armScourgePlagueSending }),
    onTriggerPoint(shroudEntering, {
      run: (runtime: NecromancerRuntime) => armPlagueSending(runtime, runtime.profession.core.selfConditions.length > 0)
    }),
    onTriggerPoint(necromancerStrikePreparing, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrikePreparing>) =>
        reactToNecromancerConditions(runtime, input.event)
    })
  ],
  id: TRAIT.PLAGUE_SENDING,
  name: 'Plague Sending',
  balance: { maximumConditions: 2 }
});

/** Terror adds damage to the skill's Fear application without creating another condition or control reaction. */
export const terror = defineTrait({
  id: TRAIT.TERROR,
  name: 'Terror',
  hooks: {
    prepareEvent: (runtime, event) =>
      event.type === 'condition' && event.condition === 'Fear' && hasTrait(runtime, TRAIT.TERROR)
        ? { ...event, conditionDamageFormula: TERROR_DAMAGE }
        : event
  }
});

const TERROR_DAMAGE = Object.freeze({ base: 444, scaling: 0.4 });

/** Lets player and Ritualist spirit critical hits advance Barbed Precision, while excluding minions. */
const necromancerBarbedPrecisionReaction = criticalProcHandler<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'necromancer.barbed-precision',
  actorTypes: ['player', 'summon', 'unknown'],
  chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.BARBED_PRECISION),
  randomStream: 'necromancer.barbed-precision',
  when: (_context, event) =>
    Number(event.coefficient) > 0 && (event.actorType !== 'summon' || event.summonKind === 'spirit'),
  handler: (context, event, _details, application) => {
    // Barbed Precision emits one condition application per threshold proc.
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const profile = requireBalanceProfileFromContext(context, TRAIT.BARBED_PRECISION);
      const effect = requireEffect(profile, 'condition', 'Bleeding');
      if (!effect) return;
      {
        /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
          context,
          TRAIT.BARBED_PRECISION,
          TRAIT.BARBED_PRECISION,
          undefined,
          {
            at: event.at,
            fullEnd: event.at,
            effect: { type: 'condition', name: 'Bleeding' },
            settlement: 'reaction',
            attribution: {
              source: 'Trait',
              sourceId: TRAIT.BARBED_PRECISION,
              actorType: 'effect',
              skillName: 'Barbed Precision',
              triggeredBy: event.skillName,
              ownerActorType: 'player',
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
  }
});

function applyChillingDarkness(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILLING_DARKNESS);
  const effect = requireEffect(profile, 'condition', 'Chilled');
  // Claim only after local eligibility, before conditions, resources or queued strikes; the cooldown gates only
  // Chill, so a removed packet leaves it ready.
  if (!effect || !context.procs.claimCooldown('chillingDarkness', event.at, balanceProfileNumber(profile, 'cooldown')))
    return;
  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
      context,
      TRAIT.CHILLING_DARKNESS,
      TRAIT.CHILLING_DARKNESS,
      undefined,
      {
        at: event.at,
        fullEnd: event.at,
        effect: { type: 'condition', name: 'Chilled' },
        settlement: 'reaction',
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.CHILLING_DARKNESS,
          actorType: 'effect',
          skillName: 'Chilling Darkness',
          triggeredBy: event.skillName,
          ownerActorType: 'player',
          name: 'Chilling Darkness' + ' - ' + effect.condition || 'Chilled'
        }
      }
    );
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Chilling Darkness', at: event.at, sourceSkill: event.skillName }
    });
  }
}

function applyInsidiousDisruption(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.INSIDIOUS_DISRUPTION);
  const effect = requireEffect(profile, 'condition', 'Torment');
  if (!effect) return;
  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
      context,
      TRAIT.INSIDIOUS_DISRUPTION,
      TRAIT.INSIDIOUS_DISRUPTION,
      undefined,
      {
        at: event.at,
        fullEnd: event.at,
        effect: { type: 'condition', name: 'Torment' },
        settlement: 'reaction',
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.INSIDIOUS_DISRUPTION,
          actorType: 'effect',
          skillName: 'Insidious Disruption',
          triggeredBy: event.skillName,
          ownerActorType: 'player',
          name: 'Insidious Disruption' + ' - ' + String(effect.condition)
        }
      }
    );
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Insidious Disruption', at: event.at, sourceSkill: event.skillName }
    });
  }
}

/** Emits furious demise at the ordered post-entry boundary. */
function enterFuriousDemise(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitTraitProfile(runtime, TRAIT.FURIOUS_DEMISE, TRAIT.FURIOUS_DEMISE, undefined, {
    skillName: requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS_DEMISE).name,
    activationId: cast.id,
    attribution: { triggeredBy: cast.skill.name },
    skillWeaponFallback: 'Unequipped',
    transform: (event) => ({ ...event, ...(event.type === 'buff' ? {} : { offTarget: cast.command.offTarget }) })
  });
}

/** Emits weakening shroud at the ordered post-entry boundary. */
function enterWeakeningShroud(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitTraitProfile(runtime, TRAIT.WEAKENING_SHROUD, TRAIT.WEAKENING_SHROUD, undefined, {
    skillName: requireBalanceProfileFromContext(runtime, TRAIT.WEAKENING_SHROUD).name,
    activationId: cast.id,
    attribution: { triggeredBy: cast.skill.name },
    skillWeaponFallback: 'Unequipped',
    transform: (event) => ({ ...event, ...(event.type === 'buff' ? {} : { offTarget: cast.command.offTarget }) })
  });
}

/** Shroud variants decide when to arm; the trait owns selection while a granted transfer survives until consumed. */
function armPlagueSending(runtime: NecromancerRuntime, hasConditions: boolean): void {
  runtime.profession.core.plagueSendingArmed = hasConditions;
}

function reactToNecromancerConditions(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const skill = skillForEvent(runtime.helpers, event);
  if (!skill) return;
  const work = { skillId: skill.id, activationId: event.activationId };
  const state = runtime.profession.core;
  if (
    state.plagueSendingArmed &&
    transfer(
      runtime,
      skill,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.PLAGUE_SENDING), 'maximumConditions'),
      work,
      true
    )
  ) {
    state.plagueSendingArmed = false;
  }
}

/** Scourge shroud-like casts arm the existing transfer without resetting an already armed unselected grant. */
function armScourgePlagueSending(runtime: NecromancerRuntime): void {
  runtime.profession.core.plagueSendingArmed = true;
}
