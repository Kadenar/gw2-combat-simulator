// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, AURA, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { combatStarted } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  attunementChanged,
  attunementInvoked,
  attunementReentered,
  auraAccepted,
  elementalistCastCompleted,
  elementalistConditionApplied,
  type ElementalistCastCompleted,
  type ElementalistEntry,
  type ElementalistReaction
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { emitEarthenBlast } from '#gw2/professions/elementalist/core/traits/earth/attunement-entry.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistResolverContext, ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Earth definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const earthsEmbrace = defineTrait({
  name: "Earth's Embrace",
  id: TRAIT.EARTHS_EMBRACE,
  balance: {
    internalCooldown: 15,
    effects: [{ type: 'boon', name: BOON.RESISTANCE, boon: BOON.RESISTANCE, stacks: 1, duration: 4 }]
  },
  triggers: [onTriggerPoint(elementalistCastCompleted, { run: applyEarthsEmbrace })]
});

export const serratedStones = defineTrait({
  name: 'Serrated Stones',
  id: TRAIT.SERRATED_STONES,
  balance: {
    damageMultiplier: 1.05,
    durationMultiplier: 20
  },
  attributes: ({ balanceContext }) => ({
    traitDurations: {
      'Bleeding Duration': balanceNumberFromContext(balanceContext, TRAIT.SERRATED_STONES, 'durationMultiplier')
    }
  }),
  modifierRules: [
    {
      order: -9,
      id: 'elementalist.serrated-stones',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.SERRATED_STONES, 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, CONDITION.BLEEDING)
    }
  ]
});

export const elementalShielding = defineTrait({
  name: 'Elemental Shielding',
  id: TRAIT.ELEMENTAL_SHIELDING,
  balance: {
    effects: [{ type: 'boon', name: BOON.PROTECTION, boon: BOON.PROTECTION, stacks: 1, duration: 3 }]
  },
  triggers: [
    onTriggerPoint(auraAccepted, {
      run: (runtime: ElementalistRuntime, { cause }: ElementalistReaction) =>
        applyResolverElementalShielding(runtime, cause)
    })
  ]
});

export const earthenBlast = defineTrait({
  name: 'Earthen Blast',
  id: TRAIT.EARTHEN_BLAST,
  balance: {
    effects: [{ name: 'Earthen Blast', type: 'strike', coefficient: 0.36, hits: 1, canCrit: false }]
  },
  // Alternate mechanic boundaries share one entry handler; only one boundary fires for each entry.
  triggers: [attunementChanged, attunementInvoked, attunementReentered].map((on) =>
    onTriggerPoint(on, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Earth',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) => {
        if (!input.claimTrait('Earth', TRAIT.EARTHEN_BLAST)) return;

        triggerEarthenBlast(runtime, input.at, input.skill.id, input.emissionCast);
      }
    })
  )
});

export const strengthOfStone = defineTrait({
  name: 'Strength of Stone',
  id: TRAIT.STRENGTH_OF_STONE,
  balance: {
    attributeConversion: 0.1,
    internalCooldown: 3,
    effects: [{ type: 'condition', name: 'Strength of Stone', condition: CONDITION.BLEEDING, stacks: 3, duration: 10 }]
  },
  attributes: traitAttributeEffects(TRAIT.STRENGTH_OF_STONE, [
    {
      kind: 'conversion',
      from: 'Toughness',
      to: 'Condition Damage',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'common'
    }
  ]),
  triggers: [
    onTriggerPoint(elementalistConditionApplied, {
      run: (runtime: ElementalistRuntime, { cause }: ElementalistReaction) => {
        if (
          cause.condition === CONDITION.IMMOBILIZED &&
          (runtime.engagement.startTime == null || cause.at >= runtime.engagement.startTime)
        )
          applyStrengthOfStone(runtime, cause);
      }
    })
  ]
});

export const rockSolid = defineTrait({
  name: 'Rock Solid',
  id: TRAIT.ROCK_SOLID,
  balance: {
    effects: [
      {
        type: 'boon',
        name: BOON.STABILITY,
        boon: BOON.STABILITY,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 3
      }
    ]
  },
  // Alternate mechanic boundaries share one entry handler; only one boundary fires for each entry.
  triggers: [attunementChanged, attunementReentered].map((on) =>
    onTriggerPoint(on, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Earth',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) => {
        if (!input.claimTrait('Earth', TRAIT.ROCK_SOLID)) return;

        grantElementalistRockSolid(runtime, input.at, input.skill.id, input.emissionCast);
      }
    })
  )
});

/** Casts and held Rock Barrier release share the same Earth-weapon eligibility and live multiplier. */
export const geomancersTrainingRechargeRule = {
  when: (_runtime: object, skill: Skill) => skill.type === 'Weapon' && skill.attunement === 'Earth',
  multiplier: { profile: TRAIT.GEOMANCERS_TRAINING, field: 'rechargeMultiplier' }
};

export const geomancersTraining = defineTrait({
  name: "Geomancer's Training",
  id: TRAIT.GEOMANCERS_TRAINING,
  balance: { rechargeMultiplier: 0.8 },
  rechargeRules: [geomancersTrainingRechargeRule]
});

export const writtenInStone = defineTrait({
  name: 'Written in Stone',
  id: TRAIT.WRITTEN_IN_STONE,
  balance: {
    effects: [
      { type: 'aura', name: 'Restoration', aura: AURA.FROST, duration: 4 },
      { type: 'aura', name: 'Fire', aura: AURA.FIRE, duration: 4 },
      { type: 'aura', name: 'Earth', aura: AURA.MAGNETIC, duration: 3 }
    ]
  },
  triggers: [onTriggerPoint(elementalistCastCompleted, { run: applyWrittenInStone })]
});

/** Grants Earth's Embrace Resistance from an eligible healing skill. */
function applyEarthsEmbrace(context: ElementalistRuntime, { cast }: ElementalistCastCompleted): void {
  const skill = cast.skill;
  const at = cast.effectiveEnd;

  if (skill.type !== 'Heal') return;

  // Claim the existing owner-local timer before any derived effect.
  if (
    !context.procs.claimCooldown(
      'earthsEmbrace',
      at,
      balanceNumberFromContext(context, TRAIT.EARTHS_EMBRACE, 'internalCooldown')
    )
  )
    return;

  emitTraitProfile(context, TRAIT.EARTHS_EMBRACE, TRAIT.EARTHS_EMBRACE, undefined, {
    at: at,
    fullEnd: at,
    effect: { type: 'boon', name: BOON.RESISTANCE },
    skillId: skill.id,
    skillName: "Earth's Embrace",
    cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
    priority: 0,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.EARTHS_EMBRACE,
      actorType: ACTOR.PLAYER,
      name: "Earth's Embrace",
      priority: 0
    }
  });
}

/** Applies Written in Stone's signet-specific aura after a completed signet cast. */
function applyWrittenInStone(context: ElementalistRuntime, { cast }: ElementalistCastCompleted): void {
  const skill = cast.skill;

  if (skill.skillFamily !== 'Signet') return;

  const signet =
    skill.id === ID.SIGNET_OF_RESTORATION
      ? 'Restoration'
      : skill.id === ID.SIGNET_OF_FIRE
        ? 'Fire'
        : skill.id === ID.SIGNET_OF_EARTH
          ? 'Earth'
          : null;

  if (!signet) return;

  const writtenInStoneProfile = requireBalanceProfileFromContext(context, TRAIT.WRITTEN_IN_STONE);
  const effect = requireEffect(writtenInStoneProfile, 'aura', signet);

  if (effect) {
    applyElementalistAura(context, {
      at: cast.effectiveEnd,
      aura: effect.aura,
      duration: effect.duration,
      skillName: 'Written in Stone',
      sourceId: skill.id
    });
  }
}

/** Applies Strength of Stone after an already-classified immobilize event. */
function applyStrengthOfStone(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  const strengthOfStoneProfile = requireBalanceProfileFromContext(context, TRAIT.STRENGTH_OF_STONE);

  // Claim the existing owner-local timer before any derived effect.
  if (
    !context.procs.claimCooldown(
      'strengthOfStone',
      event.at,
      balanceProfileNumber(strengthOfStoneProfile, 'internalCooldown')
    )
  )
    return;

  const bleeding = requireEffect(strengthOfStoneProfile, 'condition', 'Strength of Stone');

  if (bleeding) {
    emitTraitProfile(context, TRAIT.STRENGTH_OF_STONE, TRAIT.STRENGTH_OF_STONE, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: 'Strength of Stone' },
      settlement: 'reaction',
      attribution: {
        source: 'Strength of Stone',
        sourceId: 'Strength of Stone',
        actorType: ACTOR.PLAYER,
        skillName: 'Strength of Stone',
        triggeredBy: resolverSourceSkill(event)
      },
      transform: (packet) => ({ ...packet, name: 'Strength of Stone' + ' — ' + packet.condition })
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Strength of Stone', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
  }
}

/** Grants resolver-side Elemental Shielding protection for one classified aura event. */
function applyResolverElementalShielding(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  // Named selection keeps removal and patched boon fields under the shared materializer.
  emitTraitProfile(context, TRAIT.ELEMENTAL_SHIELDING, TRAIT.ELEMENTAL_SHIELDING, undefined, {
    at: event.at,
    fullEnd: event.at,
    durationContext: event,
    effect: { type: 'boon', name: BOON.PROTECTION },
    attribution: {
      actorType: ACTOR.PLAYER,
      skillName: requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SHIELDING).name,
      triggeredBy: resolverSourceSkill(event),
      priority: Number(event.priority || 0)
    },
    transform: (packet) => ({
      ...packet,
      name: requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SHIELDING).name
    })
  });
}

/** Emits Earthen Blast's uncritable strike after entering Earth in combat. */
function triggerEarthenBlast(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (!combatStarted(context, at)) return;

  emitEarthenBlast(context, at, sourceId, emissionCast);
}

/** Grants Rock Solid's Stability after entering Earth in combat. */
function grantElementalistRockSolid(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (!combatStarted(context, at)) return;

  emitTraitProfile(context, TRAIT.ROCK_SOLID, TRAIT.ROCK_SOLID, undefined, {
    at: at,
    fullEnd: at,
    effect: { type: 'boon', name: BOON.STABILITY },
    skillId: sourceId,
    skillName: 'Rock Solid',
    cast: emissionCast,
    priority: 0,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.ROCK_SOLID,
      actorType: ACTOR.PLAYER,
      name: 'Rock Solid',
      priority: 0
    }
  });
}
