import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/stats.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/events/events.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { MechanicCombatContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

import {
  attunementChanged,
  attunementInvoked,
  attunementReentered,
  type ElementalistAttunementChanged,
  type ElementalistEntry
} from '#gw2/professions/elementalist/core/mechanics/attunement-triggers.js';
import { combatStarted, elementalistAnnouncement } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { observeElementalistTransition } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { primaryAttunement } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import {
  auraAccepted,
  controlAccepted,
  elementalistCastCompleted,
  elementalistDamageResolved,
  elementalistEventPreparing,
  type ElementalistCastCompleted,
  type ElementalistDamageResolved,
  type ElementalistReaction
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { setElementalistAttunementReadyAt } from '#gw2/professions/elementalist/core/state.js';
import { emitElectricDischarge } from '#gw2/professions/elementalist/core/traits/air/attunement-entry.js';
import { criticalTraitEligible } from '#gw2/professions/elementalist/core/traits/critical-eligibility.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistModifierContext,
  ElementalistResolverContext,
  ElementalistRuntime
} from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Air definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const zephyrsSpeed = defineTrait({
  id: TRAIT.ZEPHYRS_SPEED,
  name: "Zephyr's Speed",
  balance: { criticalChance: 0.05 },
  modifierRules: [
    {
      order: -4,
      id: 'elementalist.zephyrs-speed-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ZEPHYRS_SPEED), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitCriticalChance:
      100 *
      balanceProfileNumber(requireBalanceProfileFromContext(balanceContext, TRAIT.ZEPHYRS_SPEED), 'criticalChance')
  })
});

export const freshAir = defineTrait({
  id: TRAIT.FRESH_AIR,
  triggers: [
    onTriggerPoint(attunementChanged, {
      when: (_runtime: unknown, input: ElementalistAttunementChanged) => input.target === 'Air',
      run: (runtime: ElementalistRuntime, input: ElementalistAttunementChanged) =>
        applyFreshAirAttunementEntry(runtime, input.at, input.skill, input.previous, input.emissionCast)
    }),
    onTriggerPoint(attunementReentered, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Air',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) =>
        applyFreshAirSyntheticEntry(runtime, input.at, input.skill, input.emissionCast)
    }),
    onTriggerPoint(elementalistDamageResolved, {
      run: (runtime: ElementalistRuntime, { cause, details }: ElementalistDamageResolved) =>
        applyFreshAirCritical(runtime, cause, details.hitContext!.critical)
    }),
    onTriggerPoint(elementalistEventPreparing, {
      run: (runtime: ElementalistRuntime, { event }: { readonly event: SimulationEventBase }) =>
        observeFreshAirCandidate(runtime, event)
    })
  ],
  name: 'Fresh Air',
  // Record the accepted proc once before the active elite observes its transition.
  lifetime: { eventHandlers: { 'elementalist.fresh-air': observeElementalistTransition } },
  balance: {
    attributeBonus: 250,
    effects: [{ name: 'fresh-air', type: 'buff', kind: 'fresh-air', stacks: 1, duration: 5 }]
  }
});

export const zephyrsBoon = defineTrait({
  triggers: [
    onTriggerPoint(auraAccepted, {
      run: (runtime: ElementalistRuntime, { cause }: ElementalistReaction) => applyResolverZephyrsBoon(runtime, cause)
    })
  ],
  id: TRAIT.ZEPHYRS_BOON,
  name: "Zephyr's Boon",
  balance: {
    effects: [
      { type: 'boon', name: 'Fury', boon: 'fury', stacks: 1, duration: 5 },
      { type: 'boon', name: 'Swiftness', boon: 'swiftness', stacks: 1, duration: 5 }
    ]
  }
});

export const oneWithAir = defineTrait({
  triggers: [
    onTriggerPoint(attunementChanged, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Air',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) =>
        applyOneWithAir(runtime, input.at, input.skill, input.emissionCast)
    }),
    onTriggerPoint(attunementReentered, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Air',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) =>
        applyOneWithAir(runtime, input.at, input.skill, input.emissionCast)
    })
  ],
  id: TRAIT.ONE_WITH_AIR,
  name: 'One with Air',
  balance: {
    effects: [{ type: 'buff', name: 'Superspeed', kind: 'superspeed', stacks: 1, duration: 3 }]
  }
});

export const ferociousWinds = defineTrait({
  id: TRAIT.FEROCIOUS_WINDS,
  name: 'Ferocious Winds',
  balance: { attributeConversion: 0.07 },
  buildAttributes: traitAttributeEffects(TRAIT.FEROCIOUS_WINDS, [
    {
      kind: 'conversion',
      from: 'Precision',
      to: 'Ferocity',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'common'
    }
  ])
});

export const electricDischarge = defineTrait({
  // Alternate mechanic boundaries share one entry handler; only one boundary fires for each entry.
  triggers: [attunementChanged, attunementInvoked, attunementReentered].map((on) =>
    onTriggerPoint(on, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Air',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) => {
        triggerElectricDischarge(runtime, input.at, input.skill.id, input.emissionCast);
      }
    })
  ),
  id: TRAIT.ELECTRIC_DISCHARGE,
  name: 'Electric Discharge',
  balance: {
    criticalDamage: 2,
    effects: [
      {
        type: 'strike',
        name: 'Electric Discharge',
        coefficient: 0.35,
        hits: 1
      },
      { type: 'condition', name: 'Electric Discharge', condition: 'Vulnerability', stacks: 1, duration: 8 }
    ]
  },
  modifierRules: [
    {
      requiresSelection: false,
      order: -3,
      id: 'elementalist.electric-discharge-critical-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ELECTRIC_DISCHARGE), 'criticalDamage'),
      when: (context) => (context.event?.skillName || context.event?.name || '') === 'Electric Discharge'
    }
  ]
});

export const inscription = defineTrait({
  id: TRAIT.INSCRIPTION,
  triggers: [
    onTriggerPoint(attunementChanged, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Air',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) =>
        applyInscriptionAirEntry(runtime, input.at, input.skill, input.emissionCast)
    }),
    onTriggerPoint(attunementReentered, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Air',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) =>
        applyInscriptionAirEntry(runtime, input.at, input.skill, input.emissionCast)
    }),
    onTriggerPoint(elementalistCastCompleted, { run: applyInscriptionPostCast })
  ],
  name: 'Inscription',
  balance: {
    effects: [
      { type: 'boon', name: 'Fire', boon: 'might', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Water', boon: 'regeneration', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Air', boon: 'swiftness', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Earth', boon: 'protection', stacks: 1, duration: 3 },
      { type: 'boon', name: 'Air Entry', boon: 'resistance', stacks: 1, duration: 3 }
    ]
  }
});

export const ragingStorm = defineTrait({
  id: TRAIT.RAGING_STORM,
  triggers: [
    onTriggerPoint(elementalistDamageResolved, {
      run: (runtime: ElementalistResolverContext, { cause, details }: ElementalistDamageResolved) =>
        ragingStormCritical(runtime, cause, details)
    })
  ],
  name: 'Raging Storm',
  balance: {
    internalCooldown: 8,
    attributeBonus: 180,
    effects: [{ type: 'boon', name: 'Fury', boon: 'fury', stacks: 1, duration: 4 }]
  }
});

export const aeromancersTraining = defineTrait({
  id: TRAIT.AEROMANCERS_TRAINING,
  name: "Aeromancer's Training",
  balance: {
    attributeBonus: 150,
    rechargeMultiplier: 0.8
  },
  buildAttributes: traitAttributeEffects(TRAIT.AEROMANCERS_TRAINING, [
    { kind: 'flat', to: 'Ferocity', field: 'attributeBonus', feedsConversions: false }
  ])
});

export const lightningRod = defineTrait({
  triggers: [
    onTriggerPoint(controlAccepted, {
      run: (runtime: ElementalistRuntime, { cause }: ElementalistReaction) => applyLightningRod(runtime, cause)
    })
  ],
  id: TRAIT.LIGHTNING_ROD,
  name: 'Lightning Rod',
  balance: {
    effects: [
      { name: 'Lightning Rod', type: 'strike', coefficient: 1.5, hits: 1 },
      { type: 'condition', name: 'Lightning Rod', condition: 'Weakness', stacks: 1, duration: 4 }
    ]
  }
});

export const stormsoul = defineTrait({
  id: TRAIT.STORMSOUL,
  name: 'Stormsoul',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.07 },
  modifierRules: [
    {
      order: -8,
      id: 'elementalist.stormsoul',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.STORMSOUL), 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

export const boltToTheHeart = defineTrait({
  id: TRAIT.BOLT_TO_THE_HEART,
  name: 'Bolt to the Heart',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.2, threshold: 0.5 },
  modifierRules: [
    {
      order: -6,
      id: 'elementalist.bolt-to-the-heart',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOLT_TO_THE_HEART), 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        targetHealthBelow(
          context,
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOLT_TO_THE_HEART), 'threshold')
        )
    }
  ]
});

/** Grants Inscription's current-attunement boon after a completed Glyph cast. */
function applyInscriptionPostCast(context: ElementalistRuntime, { cast }: ElementalistCastCompleted): void {
  const skill = cast.skill;
  if (skill.skillFamily !== 'Glyph') return;
  const state = professionCoreState(context);
  emitTraitProfile(context, TRAIT.INSCRIPTION, TRAIT.INSCRIPTION, undefined, {
    at: cast.effectiveEnd,
    fullEnd: cast.effectiveEnd,
    effect: { type: 'boon', name: state.primaryAttunement },
    skillId: skill.id,
    skillName: skill.name,
    cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
    priority: 0,
    attribution: { source: 'Trait', sourceId: TRAIT.INSCRIPTION, actorType: 'player', name: skill.name, priority: 0 }
  });
}

/** Materializes Lightning Rod from a classified player control event. */
function applyLightningRod(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  const sourceId = event.skillId ?? event.sourceId;
  const lightningRodProfile = requireBalanceProfileFromContext(context, TRAIT.LIGHTNING_ROD);
  const lightningRodStrike = requireEffect(lightningRodProfile, 'strike', 'Lightning Rod');
  if (lightningRodStrike) {
    emitTraitProfile(context, TRAIT.LIGHTNING_ROD, TRAIT.LIGHTNING_ROD, event, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'strike', name: 'Lightning Rod' },
      cast: emissionCast,
      skillWeaponFallback: 'Unequipped',
      attribution: {
        source: 'Lightning Rod',
        sourceId: sourceId,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: 'Lightning Rod',
        skillId: sourceId,
        name: 'Lightning Rod',
        activationId: context.combat.allocateEffectActivation('elementalist.effect:')
      }
    });
  }

  const conditionEmitted =
    emitTraitProfile(context, TRAIT.LIGHTNING_ROD, TRAIT.LIGHTNING_ROD, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: 'Lightning Rod' },
      skillId: sourceId,
      skillName: 'Lightning Rod',
      cast: emissionCast,
      attribution: { source: 'Lightning Rod', sourceId: sourceId, actorType: 'player', triggeredBy: '' },
      transform: (event) => ({ ...event, name: 'Lightning Rod' + ' \u2014 ' + event.condition }),
      receipt: true
    }).length > 0;
  if (lightningRodStrike || conditionEmitted)
    context.effects.emit(
      elementalistAnnouncement({
        at: event.at,
        name: 'Lightning Rod',
        procType: 'trait',
        sourceId,
        sourceSkill: event.skillName || event.source || ''
      })
    );
}

/** Grants resolver-side Zephyr's Boon effects for one classified aura event. */
function applyResolverZephyrsBoon(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  // The profile owns both aura boons; one emission preserves their authored order and live duration policy.
  emitTraitProfile(context, TRAIT.ZEPHYRS_BOON, TRAIT.ZEPHYRS_BOON, undefined, {
    at: event.at,
    fullEnd: event.at,
    durationContext: event,
    effects: (effect) => effect.type === 'boon',
    attribution: {
      actorType: 'player',
      skillName: requireBalanceProfileFromContext(context, TRAIT.ZEPHYRS_BOON).name,
      triggeredBy: resolverSourceSkill(event),
      priority: Number(event.priority || 0)
    },
    transform: (packet) => ({ ...packet, name: requireBalanceProfileFromContext(context, TRAIT.ZEPHYRS_BOON).name })
  });
}

/** Preserve the live air attribute pass at its original position in the Core modifier pipeline. */
export function applyAirTraitAttributes(context: ElementalistModifierContext, modified: Gw2MutableStats): void {
  const primary = primaryAttunement(context);
  if (hasTrait(context, TRAIT.FRESH_AIR) && activeBuffStacks(context, 'fresh-air', 1) > 0) {
    const freshAirProfile = requireBalanceProfileFromContext(context, TRAIT.FRESH_AIR);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(freshAirProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.AEROMANCERS_TRAINING) && primary === 'Air') {
    const aeromancersTrainingProfile = requireBalanceProfileFromContext(context, TRAIT.AEROMANCERS_TRAINING);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(aeromancersTrainingProfile, 'attributeBonus');
  }

  if (
    hasTrait(context, TRAIT.RAGING_STORM) &&
    Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  ) {
    const ragingStormProfile = requireBalanceProfileFromContext(context, TRAIT.RAGING_STORM);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(ragingStormProfile, 'attributeBonus');
  }
}

/** Scale this element's weapon recharge after the mechanic has handled held and non-weapon cooldowns. */
export function aeromancersTrainingRecharge(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  duration: number
): number {
  return skill.attunement === 'Air' && hasTrait(context, TRAIT.AEROMANCERS_TRAINING)
    ? duration *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.AEROMANCERS_TRAINING),
          'rechargeMultiplier'
        )
    : duration;
}

/** Materializes Raging Storm after its registered critical-hit reaction succeeds. */
function applyRagingStorm(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const ragingStormProfile = requireBalanceProfileFromContext(context, TRAIT.RAGING_STORM);
  const fury = requireEffect(ragingStormProfile, 'boon', 'Fury');
  if (fury) {
    emitTraitProfile(context, TRAIT.RAGING_STORM, TRAIT.RAGING_STORM, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'boon', name: 'Fury' },
      durationContext: event,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.RAGING_STORM,
        actorType: 'player',
        skillName: requireBalanceProfileFromContext(context, TRAIT.RAGING_STORM).name,
        triggeredBy: resolverSourceSkill(event),
        priority: Number(event.priority || 0)
      },
      transform: (packet) => ({ ...packet, name: requireBalanceProfileFromContext(context, TRAIT.RAGING_STORM).name })
    });
  }
}

/** Only an accepted player critical hit can reset Air's actual recharge. */
function applyFreshAirCritical(
  context: ElementalistRuntime,
  event: Gw2ResolverEvent,
  critical: { chance: number; didCrit?: boolean }
): void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    context.profession.core.primaryAttunement === 'Air' ||
    !critical.didCrit
  )
    return;
  if ((context.cooldownController.readyAt(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air) ?? 0) > event.at)
    setElementalistAttunementReadyAt(context, 'Air', event.at);
  context.effects.emit({
    kind: 'packet',
    cause: event,
    event: {
      type: 'elementalist.fresh-air',
      at: event.at,
      source: 'Fresh Air',
      sourceId: 'Fresh Air',
      actorType: 'effect',
      skillName: 'Fresh Air',
      sourceSkill: event.skillName
    }
  });
}

/** Only Fresh Air records future player strike wakes; this never predicts their critical result. */
function observeFreshAirCandidate(runtime: ElementalistRuntime, event: SimulationEventBase): void {
  if (
    event.type === 'damage' &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    canonicalTime(event.at) > runtime.time
  ) {
    // Only Fresh Air needs strike wakes; retire elapsed times as new work arrives.
    const core = runtime.profession.core;
    core.freshAirCandidates = core.freshAirCandidates.filter((at) => at > runtime.time);
    core.freshAirCandidates.push(canonicalTime(event.at));
  }
}

/** Keep ragingStorm's critical sampling and timer with its effect owner; the trigger point fixes cross-trait order. */
const ragingStormCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.raging-storm',
  when: (_context, event, details) => criticalTraitEligible(event, details),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RAGING_STORM), 'internalCooldown'),
    readyAt: (context) => context.procs.deadline('ragingStorm') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('ragingStorm', readyAt);
    }
  },
  handler: applyRagingStorm
});

/** Emits Electric Discharge from a qualifying Air-attunement transition. */
function triggerElectricDischarge(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (!combatStarted(context, at)) return;
  emitElectricDischarge(context, at, sourceId, emissionCast);
}

/** Opens Fresh Air's ferocity window when an attunement transition newly enters Air. */
function applyFreshAirAttunementEntry(
  context: ElementalistRuntime,
  at: number,
  skill: Skill,
  previous: string,
  emissionCast?: EffectDelivery['cast']
): void {
  if (previous === 'Air') return;
  const freshAirProfile = requireBalanceProfileFromContext(context, TRAIT.FRESH_AIR);
  const freshAir = requireEffect(freshAirProfile, 'buff', 'fresh-air');
  if (freshAir) {
    emitTraitProfile(context, TRAIT.FRESH_AIR, TRAIT.FRESH_AIR, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'buff', name: 'fresh-air' },
      cast: emissionCast,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.FRESH_AIR,
        actorType: 'player',
        skillName: skill.name,
        priority: -10,
        skillId: skill.id,
        name: skill.name
      },
      transform: (packet) => ({ ...packet, kind: 'fresh-air' })
    });
  }
}

/** Reads Superspeed as a buff so profile overrides apply without boon-duration scaling. */
function applyOneWithAir(
  context: ElementalistRuntime,
  at: number,
  skill: Skill,
  emissionCast?: EffectDelivery['cast']
): void {
  const oneWithAirProfile = requireBalanceProfileFromContext(context, TRAIT.ONE_WITH_AIR);
  const superspeed = requireEffect(oneWithAirProfile, 'buff', 'Superspeed');
  if (superspeed) {
    emitTraitProfile(context, TRAIT.ONE_WITH_AIR, TRAIT.ONE_WITH_AIR, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'buff', name: 'Superspeed' },
      cast: emissionCast,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.ONE_WITH_AIR,
        actorType: 'player',
        skillName: skill.name,
        skillId: skill.id,
        name: skill.name
      }
    });
  }
}

/** Grants Inscription's dedicated Resistance effect after entering Air. */
function applyInscriptionAirEntry(
  context: ElementalistRuntime,
  at: number,
  skill: Skill,
  emissionCast?: EffectDelivery['cast']
): void {
  {
    emitTraitProfile(context, TRAIT.INSCRIPTION, TRAIT.INSCRIPTION, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'boon', name: 'Air Entry' },
      skillId: skill.id,
      skillName: skill.name,
      cast: emissionCast,
      priority: 0,
      attribution: { source: 'Trait', sourceId: TRAIT.INSCRIPTION, actorType: 'player', name: skill.name, priority: 0 }
    });
  }
}

/** A familiar-triggered Air entry refreshes Fresh Air without requiring a preceding different element. */
function applyFreshAirSyntheticEntry(
  context: ElementalistRuntime,
  at: number,
  skill: Skill,
  emissionCast?: EffectDelivery['cast']
): void {
  {
    const freshAirProfile = requireBalanceProfileFromContext(context, TRAIT.FRESH_AIR);
    const freshAir = requireEffect(freshAirProfile, 'buff', 'fresh-air');
    if (freshAir) {
      emitTraitProfile(context, TRAIT.FRESH_AIR, TRAIT.FRESH_AIR, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'buff', name: 'fresh-air' },
        cast: emissionCast,
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.FRESH_AIR,
          actorType: 'player',
          skillName: skill.name,
          skillId: skill.id,
          name: skill.name
        }
      });
    }
  }
}
