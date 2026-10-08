import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/stats.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicCombatContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  elementalistAnnouncement,
  elementalistProfiledBuffRequest,
  elementalistProfiledConditionRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { observeElementalistTransition } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { primaryAttunement } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistModifierContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

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
  name: 'Fresh Air',
  // Record the accepted proc once before the active elite observes its transition.
  hooks: { eventHandlers: { 'elementalist.fresh-air': observeElementalistTransition } },
  balance: {
    attributeBonus: 250,
    effects: [{ name: 'fresh-air', type: 'buff', kind: 'fresh-air', stacks: 1, duration: 5 }]
  }
});

export const zephyrsBoon = defineTrait({
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
  modifierRules: [
    {
      order: -8,
      id: 'elementalist.stormsoul',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.07,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

export const boltToTheHeart = defineTrait({
  id: TRAIT.BOLT_TO_THE_HEART,
  name: 'Bolt to the Heart',
  modifierRules: [
    {
      order: -6,
      id: 'elementalist.bolt-to-the-heart',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.2,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetHealthBelow(context, 0.5)
    }
  ]
});

/** Grants Inscription's current-attunement boon after a completed Glyph cast. */
export function applyInscriptionPostCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (!hasTrait(context, TRAIT.INSCRIPTION) || skill.skillFamily !== 'Glyph') return;
  const state = professionCoreState(context);
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      cast.effectiveEnd,
      TRAIT.INSCRIPTION,
      state.primaryAttunement,
      skill.name,
      skill.id,
      undefined,
      undefined,
      { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    )
  );
}

/** Materializes Lightning Rod from a classified player control event. */
export function applyLightningRod(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  if (!hasTrait(context, TRAIT.LIGHTNING_ROD)) return;
  const sourceId = event.skillId ?? event.sourceId;
  const lightningRodProfile = requireBalanceProfileFromContext(context, TRAIT.LIGHTNING_ROD);
  const lightningRodStrike = requireEffect(lightningRodProfile, 'strike', 'Lightning Rod');
  if (lightningRodStrike) {
    context.effects.emit(
      elementalistStrikeRequest(
        context,
        {
          cause: event,
          at: event.at,
          source: 'Lightning Rod',
          sourceId,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: 'Lightning Rod',
          coefficient: effectNumber(lightningRodProfile, lightningRodStrike, 'coefficient'),
          skillWeapon: 'Unequipped'
        },
        emissionCast
      )
    );
  }

  const conditionEmitted =
    context.effects.emit({
      ...elementalistProfiledConditionRequest(
        context,
        event.at,
        TRAIT.LIGHTNING_ROD,
        'Lightning Rod',
        'Lightning Rod',
        sourceId,
        undefined,
        emissionCast
      ),
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

/** Accepted auras select the current trait profile before shared boon-duration scaling. */
function zephyrsBoonEffects(context: unknown) {
  return ['Fury', 'Swiftness'].flatMap((name) => {
    const zephyrsBoonProfile = requireBalanceProfileFromContext(context, TRAIT.ZEPHYRS_BOON);
    const effect = requireEffect(zephyrsBoonProfile, 'boon', name);
    if (!effect) return [];
    return [
      {
        kind: String(effect.boon).toLowerCase(),
        stacks: Number(effect.stacks),
        duration: effect.duration
      }
    ];
  });
}

/** Grants resolver-side Zephyr's Boon effects for one classified aura event. */
export function applyResolverZephyrsBoon(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.ZEPHYRS_BOON)) return;
  for (const boon of zephyrsBoonEffects(context)) {
    context.effects.emit({
      kind: 'packet',
      durationContext: event,
      event: {
        type: 'buff',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.ZEPHYRS_BOON,
        actorType: 'player',
        skillName: requireBalanceProfileFromContext(context, TRAIT.ZEPHYRS_BOON).name,
        kind: boon.kind.toLowerCase(),
        stacks: boon.stacks,
        duration: boon.duration,
        triggeredBy: resolverSourceSkill(event),
        priority: Number(event.priority || 0)
      }
    });
  }
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
