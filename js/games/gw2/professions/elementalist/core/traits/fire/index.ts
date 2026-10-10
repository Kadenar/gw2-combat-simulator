import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { powerScaledConditionAttributes } from '#gw2/platform/combat-calculation/condition-attributes.js';
import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/stats.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { MechanicCombatContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  attunementChanged,
  attunementInvoked,
  attunementReentered,
  attunementReleased,
  type ElementalistAttunementChanged,
  type ElementalistAttunementCount,
  type ElementalistEntry
} from '#gw2/professions/elementalist/core/mechanics/attunement-triggers.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { combatStarted } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  elementalistMightStacks,
  primaryAttunement
} from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import {
  conjureEquipped,
  elementalistCastCompleted,
  elementalistConditionApplied,
  elementalistDamageResolved,
  type ElementalistCastCompleted,
  type ElementalistDamageResolved,
  type ElementalistReaction
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { criticalTraitEligible } from '#gw2/professions/elementalist/core/traits/critical-eligibility.js';
import {
  emitFlameExpulsion,
  emitSunspot
} from '#gw2/professions/elementalist/core/traits/fire/attunement-transition.js';
import {
  extendPersistingFlamesEffects,
  extendPersistingFlamesFields
} from '#gw2/professions/elementalist/core/traits/fire/persisting-flames.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistModifierContext,
  ElementalistResolverContext,
  ElementalistRuntime
} from '#gw2/professions/elementalist/types.js';

/** Fire definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const empoweringFlame = defineTrait({
  id: TRAIT.EMPOWERING_FLAME,
  name: 'Empowering Flame',
  balance: { attributeBonus: 150 }
});

export const inferno = defineTrait({
  id: TRAIT.INFERNO,
  name: 'Inferno',
  // Convert the intended Power rate through the canonical Burning scaling used by combat.
  balance: { coefficientMultiplier: 0.0825 / CONDITION_FORMULAS.Burning.scaling }
});

export const burningPrecision = defineTrait({
  id: TRAIT.BURNING_PRECISION,
  triggers: [
    onTriggerPoint(elementalistDamageResolved, {
      run: (runtime: ElementalistResolverContext, { cause, details }: ElementalistDamageResolved) =>
        burningPrecisionCritical(runtime, cause, details)
    })
  ],
  name: 'Burning Precision',
  balance: {
    procRate: {
      id: 'elementalist.burning-precision',
      traitId: TRAIT.BURNING_PRECISION,
      field: 'procChance',
      opportunity: 'eligible critical hit'
    },
    procChance: 0.33,
    internalCooldown: 5,
    durationMultiplier: 20,
    effects: [{ type: 'condition', name: 'Burning Precision', condition: 'Burning', stacks: 1, duration: 3 }]
  },
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Burning Duration': balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.BURNING_PRECISION),
        'durationMultiplier'
      )
    }
  })
});

export const conjurer = defineTrait({
  id: TRAIT.CONJURER,
  triggers: [onTriggerPoint(conjureEquipped, { run: applyConjurerAura })],
  name: 'Conjurer',
  balance: {
    effects: [{ type: 'buff', name: 'Conjurer', kind: 'Fire Aura', stacks: 1, duration: 4 }]
  }
});

export const sunspot = defineTrait({
  // Alternate mechanic boundaries share one entry handler; only one boundary fires for each entry.
  triggers: [attunementChanged, attunementInvoked, attunementReentered].map((on) =>
    onTriggerPoint(on, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Fire',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) => {
        if (!input.claimTrait('Fire', TRAIT.SUNSPOT)) return;
        triggerSunspot(runtime, input.at, input.skill.id, applyElementalistAura, input.emissionCast);
      }
    })
  ),
  id: TRAIT.SUNSPOT,
  name: 'Sunspot',
  balance: {
    effects: [
      { type: 'buff', name: 'Sunspot Aura', kind: 'Fire Aura', stacks: 1, duration: 3 },
      { type: 'strike', name: 'Sunspot', coefficient: 0.6, hits: 1, canCrit: false }
    ]
  }
});

export const burningRage = defineTrait({
  id: TRAIT.BURNING_RAGE,
  name: 'Burning Rage',
  balance: {
    // The replacement burning belongs to Sunspot's shared trigger.
    damagePreviewAttribution: 'shared',
    attributeBonus: 180,
    durationMultiplier: 20,
    effects: [{ type: 'condition', name: 'Sunspot Burning', condition: 'Burning', stacks: 2, duration: 4 }]
  },
  buildAttributes: traitAttributeEffects(TRAIT.BURNING_RAGE, [
    { kind: 'flat', to: 'Condition Damage', field: 'attributeBonus', feedsConversions: false }
  ])
});

export const smotheringAuras = defineTrait({
  id: TRAIT.SMOTHERING_AURAS,
  name: 'Smothering Auras',
  balance: { durationMultiplier: 1.33 }
});

export const powerOverwhelming = defineTrait({
  id: TRAIT.POWER_OVERWHELMING,
  name: 'Power Overwhelming',
  balance: {
    minimumStacks: 10,
    attributeBonus: 150,
    weaponAttributeBonus: 300
  }
});

export const pyromancersTraining = defineTrait({
  id: TRAIT.PYROMANCERS_TRAINING,
  name: "Pyromancer's Training",
  balance: {
    damageMultiplier: 1.07,
    rechargeMultiplier: 0.8
  },
  modifierRules: [
    {
      order: -10,
      id: 'elementalist.pyromancers-training',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PYROMANCERS_TRAINING), 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Burning')
    }
  ]
});

export const pyromancersPuissance = defineTrait({
  id: TRAIT.PYROMANCERS_PUISSANCE,
  triggers: [
    onTriggerPoint(attunementChanged, {
      when: (_runtime: unknown, input: ElementalistAttunementChanged) =>
        input.previous === 'Fire' && input.target !== 'Fire',
      run: (runtime: ElementalistRuntime, input: ElementalistAttunementChanged) => {
        if (!input.claimTrait('Fire', TRAIT.PYROMANCERS_PUISSANCE)) return;
        triggerFlameExpulsion(runtime, input.at, input.skill.id, input.emissionCast);
      }
    }),
    onTriggerPoint(attunementReleased, {
      run: (runtime: ElementalistRuntime, input: Omit<ElementalistAttunementCount, 'stacks'>) =>
        triggerFlameExpulsion(runtime, input.at, input.sourceId, input.emissionCast)
    }),
    onTriggerPoint(elementalistCastCompleted, { run: applyPyromancersPuissance })
  ],
  name: "Pyromancer's Puissance",
  balance: {
    // Measured Fire-exit-to-impact delay, separate from the instant attunement swap.
    initialDelay: 0.68,
    maximumStacks: 10,
    damageIncreasePerStack: 0.1,
    durationPerTier: 0.5,
    effects: [
      { type: 'boon', name: 'Attunement Might', boon: 'might', stacks: 1, duration: 15 },
      { type: 'boon', name: 'Flame Expulsion Might', boon: 'might', stacks: 1, duration: 15 },
      { type: 'strike', name: 'Flame Expulsion', coefficient: 1, hits: 1 },
      { type: 'condition', name: 'Flame Expulsion', condition: 'Burning', stacks: 1, duration: 2 }
    ]
  }
});

/** Own field extensions, stack lifetime, and damage tuning while keeping ordered resolver calls explicit. */
export const persistingFlames = defineTrait({
  id: TRAIT.PERSISTING_FLAMES,
  triggers: [
    onTriggerPoint(elementalistDamageResolved, {
      run: (runtime: ElementalistRuntime, { cause }: ElementalistDamageResolved) =>
        applyPersistingFlamesDamage(runtime, cause)
    }),
    onTriggerPoint(elementalistConditionApplied, {
      run: (runtime: ElementalistRuntime, { cause }: ElementalistReaction) =>
        applyPersistingFlamesCondition(runtime, cause)
    })
  ],
  name: 'Persisting Flames',
  balance: {
    damageIncreasePerStack: 0.02,
    durationMultiplier: 15,
    durationPerTier: 2,
    summons: 2,
    maximumStacks: 5
  },
  modifierRules: [
    {
      id: 'elementalist.persisting-flames',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      order: -11,

      amount: (context) =>
        activeBuffStacks(
          context,
          'persisting flames',
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PERSISTING_FLAMES), 'maximumStacks')
        ) *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.PERSISTING_FLAMES),
          'damageIncreasePerStack'
        )
    }
  ],
  hooks: {
    modifyEffects: (runtime: MechanicQueriesOf<ElementalistRuntime>, cast, effects) =>
      extendPersistingFlamesEffects(runtime, cast.skill, effects),
    modifyComboFields: extendPersistingFlamesFields
  }
});

/** Grants Pyromancer's Puissance might after an in-combat Fire-attuned cast. */
function applyPyromancersPuissance(context: ElementalistRuntime, { cast }: ElementalistCastCompleted): void {
  const skill = cast.skill;
  const at = cast.effectiveEnd;
  if (professionCoreState(context).primaryAttunement !== 'Fire' || !combatStarted(context, at)) return;
  emitTraitProfile(context, TRAIT.PYROMANCERS_PUISSANCE, TRAIT.PYROMANCERS_PUISSANCE, undefined, {
    at: at,
    fullEnd: at,
    effect: { type: 'boon', name: 'Attunement Might' },
    skillId: skill.id,
    skillName: skill.name,
    cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
    priority: 0,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.PYROMANCERS_PUISSANCE,
      actorType: 'player',
      name: skill.name,
      priority: 0
    }
  });
}

/** Conjurer grants its aura between bundle creation and the resulting swap events. */
function applyConjurerAura(context: ElementalistRuntime, { cast }: ElementalistCastCompleted): void {
  const skill = cast.skill;
  const at = cast.effectiveEnd;
  {
    const conjurerProfile = requireBalanceProfileFromContext(context, TRAIT.CONJURER);
    const conjurerBuff = requireEffect(conjurerProfile, 'buff', 'Conjurer');
    if (conjurerBuff) {
      applyElementalistAura(context, {
        at,
        aura: String(conjurerBuff.kind),
        duration: conjurerBuff.duration,
        skillName: 'Conjurer',
        sourceId: skill.id
      });
    }
  }
}

/** Preserve the live fire attribute pass at its original position in the Core modifier pipeline. */
export function applyFireTraitAttributes(context: ElementalistModifierContext, modified: Gw2MutableStats): void {
  const primary = primaryAttunement(context);
  if (hasTrait(context, TRAIT.EMPOWERING_FLAME) && primary === 'Fire') {
    const empoweringFlameProfile = requireBalanceProfileFromContext(context, TRAIT.EMPOWERING_FLAME);
    modified.power = (modified.power || 0) + balanceProfileNumber(empoweringFlameProfile, 'attributeBonus');
  }

  if (
    hasTrait(context, TRAIT.POWER_OVERWHELMING) &&
    elementalistMightStacks(context) >=
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.POWER_OVERWHELMING), 'minimumStacks')
  ) {
    const powerOverwhelmingProfile = requireBalanceProfileFromContext(context, TRAIT.POWER_OVERWHELMING);
    modified.power =
      (modified.power || 0) +
      (primary === 'Fire'
        ? balanceProfileNumber(powerOverwhelmingProfile, 'weaponAttributeBonus')
        : balanceProfileNumber(powerOverwhelmingProfile, 'attributeBonus'));
  }
}

/** Inferno converts final Power only for its Burning packets at condition-attribute evaluation. */
export function applyInfernoAttributes(context: ElementalistModifierContext, attributes: Gw2Stats): Gw2Stats {
  return powerScaledConditionAttributes(context, attributes, 'Burning', TRAIT.INFERNO);
}

/** Scale this element's weapon recharge after the mechanic has handled held and non-weapon cooldowns. */
export function pyromancersTrainingRecharge(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  duration: number
): number {
  return skill.attunement === 'Fire' && hasTrait(context, TRAIT.PYROMANCERS_TRAINING)
    ? duration *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.PYROMANCERS_TRAINING),
          'rechargeMultiplier'
        )
    : duration;
}

/** Materializes Burning Precision after its registered critical-hit reaction succeeds. */
function applyBurningPrecision(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const burningPrecisionProfile = requireBalanceProfileFromContext(context, TRAIT.BURNING_PRECISION);
  const burning = requireEffect(burningPrecisionProfile, 'condition', 'Burning Precision');
  if (burning) {
    emitTraitProfile(context, TRAIT.BURNING_PRECISION, TRAIT.BURNING_PRECISION, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: 'Burning Precision' },
      settlement: 'reaction',
      attribution: {
        source: 'Burning Precision',
        sourceId: TRAIT.BURNING_PRECISION,
        actorType: 'player',
        skillName: 'Burning Precision',
        triggeredBy: resolverSourceSkill(event),
        metadata: { procCount: 1 }
      },
      transform: (packet) => ({ ...packet, name: 'Burning Precision' + ' — ' + packet.condition })
    });

    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Burning Precision', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
  }
}

/** Keep burningPrecision's critical sampling and timer with its effect owner; the trigger point fixes cross-trait order. */
const burningPrecisionCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.burning-precision',
  chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.BURNING_PRECISION),
  when: (_context, event, details) => criticalTraitEligible(event, details),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BURNING_PRECISION), 'internalCooldown'),
    readyAt: (context) => context.procs.deadline('burningPrecision') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('burningPrecision', readyAt);
    }
  },
  randomStream: 'elementalist.burning-precision',
  handler: applyBurningPrecision
});

// Materialize Sunspot's aura, strike, Burning, and proc at the entry timestamp.
function triggerSunspot(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  applyAura: ElementalistAuraApplier,
  emissionCast?: EffectDelivery['cast']
): void {
  if (!combatStarted(context, at)) return;
  emitSunspot(context, at, sourceId, applyAura, emissionCast);
}

// Snapshot capped Might on Fire exit; the delayed blast damages enemies and grants that Might to other allies.
function triggerFlameExpulsion(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (!combatStarted(context, at)) return;
  emitFlameExpulsion(context, at, sourceId, emissionCast);
}

/** Grants one resolver-side Persisting Flames stack from a classified field tick or Burning application. */
function grantPersistingFlames(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const persistingFlamesProfile = requireBalanceProfileFromContext(context, TRAIT.PERSISTING_FLAMES);
  context.effects.emit({
    kind: 'packet',
    durationContext: event,
    event: {
      type: 'buff',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.PERSISTING_FLAMES,
      actorType: 'player',
      skillName: requireBalanceProfileFromContext(context, TRAIT.PERSISTING_FLAMES).name,
      kind: 'Persisting Flames'.toLowerCase(),
      stacks: 1,
      duration: balanceProfileNumber(persistingFlamesProfile, 'durationMultiplier'),
      triggeredBy: resolverSourceSkill(event),
      priority: Number(event.priority || 0)
    }
  });
}

/** Fire-field rewards precede Shattering Stone; profession fields grant stacks without gaining extra packets. */
function applyPersistingFlamesDamage(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  if (
    event.damageKind === 'field-tick' &&
    context.helpers.skillsById
      .get(event.skillId ?? event.sourceId)
      ?.comboFields?.some((field) => field.fieldType === 'Fire')
  )
    grantPersistingFlames(context, event);
}

/** Burning rewards stay after Strength of Stone in the accepted-condition reaction. */
function applyPersistingFlamesCondition(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  if (event.condition === 'Burning') grantPersistingFlames(context, event);
}
