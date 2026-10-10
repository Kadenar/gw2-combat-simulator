import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasSelectedSkillId, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/stats.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { MechanicCombatContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
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
  type ElementalistEntry
} from '#gw2/professions/elementalist/core/mechanics/attunement-triggers.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { combatStarted } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  auraAccepted,
  elementalistCastCompleted,
  elementalistConditionApplied,
  type ElementalistCastCompleted,
  type ElementalistReaction
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profile-ids.js';
import { emitEarthenBlast } from '#gw2/professions/elementalist/core/traits/earth/attunement-entry.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistModifierContext,
  ElementalistResolverContext,
  ElementalistRuntime
} from '#gw2/professions/elementalist/types.js';

/** Earth definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const earthsEmbrace = defineTrait({
  id: TRAIT.EARTHS_EMBRACE,
  triggers: [onTriggerPoint(elementalistCastCompleted, { run: applyEarthsEmbrace })],
  name: "Earth's Embrace",
  balance: {
    internalCooldown: 15,
    effects: [{ type: 'boon', name: 'Resistance', boon: 'resistance', stacks: 1, duration: 4 }]
  }
});

export const serratedStones = defineTrait({
  id: TRAIT.SERRATED_STONES,
  name: 'Serrated Stones',
  balance: { durationMultiplier: 20 },
  modifierRules: [
    {
      order: -9,
      id: 'elementalist.serrated-stones',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.05,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Bleeding')
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Bleeding Duration': balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.SERRATED_STONES),
        'durationMultiplier'
      )
    }
  })
});

export const elementalShielding = defineTrait({
  triggers: [
    onTriggerPoint(auraAccepted, {
      run: (runtime: ElementalistRuntime, { cause }: ElementalistReaction) =>
        applyResolverElementalShielding(runtime, cause)
    })
  ],
  id: TRAIT.ELEMENTAL_SHIELDING,
  name: 'Elemental Shielding',
  balance: {
    effects: [{ type: 'boon', name: 'Protection', boon: 'protection', stacks: 1, duration: 3 }]
  }
});

export const earthenBlast = defineTrait({
  // Alternate mechanic boundaries share one entry handler; only one boundary fires for each entry.
  triggers: [attunementChanged, attunementInvoked, attunementReentered].map((on) =>
    onTriggerPoint(on, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Earth',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) => {
        if (!input.claimTrait('Earth', TRAIT.EARTHEN_BLAST)) return;
        triggerEarthenBlast(runtime, input.at, input.skill.id, input.emissionCast);
      }
    })
  ),
  id: TRAIT.EARTHEN_BLAST,
  name: 'Earthen Blast',
  balance: {
    effects: [{ name: 'Earthen Blast', type: 'strike', coefficient: 0.36, hits: 1, canCrit: false }]
  }
});

export const strengthOfStone = defineTrait({
  id: TRAIT.STRENGTH_OF_STONE,
  triggers: [
    onTriggerPoint(elementalistConditionApplied, {
      run: (runtime: ElementalistRuntime, { cause }: ElementalistReaction) => {
        if (
          cause.condition === 'Immobilized' &&
          (runtime.combatStartTime == null || cause.at >= runtime.combatStartTime)
        )
          applyStrengthOfStone(runtime, cause);
      }
    })
  ],
  name: 'Strength of Stone',
  balance: {
    attributeConversion: 0.1,
    internalCooldown: 3,
    effects: [{ type: 'condition', name: 'Strength of Stone', condition: 'Bleeding', stacks: 3, duration: 10 }]
  },
  buildAttributes: traitAttributeEffects(TRAIT.STRENGTH_OF_STONE, [
    {
      kind: 'conversion',
      from: 'Toughness',
      to: 'Condition Damage',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'common'
    }
  ])
});

export const rockSolid = defineTrait({
  // Alternate mechanic boundaries share one entry handler; only one boundary fires for each entry.
  triggers: [attunementChanged, attunementReentered].map((on) =>
    onTriggerPoint(on, {
      when: (_runtime: unknown, input: ElementalistEntry) => input.target === 'Earth',
      run: (runtime: ElementalistRuntime, input: ElementalistEntry) => {
        if (!input.claimTrait('Earth', TRAIT.ROCK_SOLID)) return;
        grantElementalistRockSolid(runtime, input.at, input.skill.id, input.emissionCast);
      }
    })
  ),
  id: TRAIT.ROCK_SOLID,
  name: 'Rock Solid',
  balance: {
    effects: [{ type: 'boon', name: 'Stability', boon: 'stability', stacks: 1, duration: 3 }]
  }
});

export const geomancersTraining = defineTrait({
  id: TRAIT.GEOMANCERS_TRAINING,
  name: "Geomancer's Training",
  balance: { rechargeMultiplier: 0.8 }
});

export const writtenInStone = defineTrait({
  id: TRAIT.WRITTEN_IN_STONE,
  triggers: [onTriggerPoint(elementalistCastCompleted, { run: applyWrittenInStone })],
  name: 'Written in Stone',
  balance: {
    effects: [
      { type: 'buff', name: 'Restoration', kind: 'Frost Aura', stacks: 1, duration: 4 },
      { type: 'buff', name: 'Fire', kind: 'Fire Aura', stacks: 1, duration: 4 },
      { type: 'buff', name: 'Earth', kind: 'Magnetic Aura', stacks: 1, duration: 3 }
    ]
  }
});

/** Grants Earth's Embrace Resistance from an eligible healing skill. */
function applyEarthsEmbrace(context: ElementalistRuntime, { cast }: ElementalistCastCompleted): void {
  const skill = cast.skill;
  const at = cast.effectiveEnd;
  if (skill.type !== 'Heal') return;
  const earthsEmbraceProfile = requireBalanceProfileFromContext(context, TRAIT.EARTHS_EMBRACE);
  // Claim the existing owner-local timer before any derived effect.
  if (!context.procs.claimCooldown('earthsEmbrace', at, balanceProfileNumber(earthsEmbraceProfile, 'internalCooldown')))
    return;
  emitTraitProfile(context, TRAIT.EARTHS_EMBRACE, TRAIT.EARTHS_EMBRACE, undefined, {
    at: at,
    fullEnd: at,
    effect: { type: 'boon', name: 'Resistance' },
    skillId: skill.id,
    skillName: "Earth's Embrace",
    cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
    priority: 0,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.EARTHS_EMBRACE,
      actorType: 'player',
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
  const effect = requireEffect(writtenInStoneProfile, 'buff', signet);
  if (effect) {
    applyElementalistAura(context, {
      at: cast.effectiveEnd,
      aura: String(effect.kind),
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
        actorType: 'player',
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
    effect: { type: 'boon', name: 'Protection' },
    attribution: {
      actorType: 'player',
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

/** Preserve the live earth attribute pass at its original position in the Core modifier pipeline. */
export function reconcileSignetPassive(context: ElementalistModifierContext, modified: Gw2MutableStats): void {
  if (
    hasSelectedSkillId(context, ID.SIGNET_OF_FIRE) &&
    !hasTrait(context, TRAIT.WRITTEN_IN_STONE) &&
    context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_FIRE, context.time)
  ) {
    const signetOfFireProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfFire);
    modified.precision = (modified.precision || 0) - balanceProfileNumber(signetOfFireProfile, 'attributeBonus');
  }
}

/** Scale this element's weapon recharge after the mechanic has handled held and non-weapon cooldowns. */
export function geomancersTrainingRecharge(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  duration: number
): number {
  return skill.attunement === 'Earth' && hasTrait(context, TRAIT.GEOMANCERS_TRAINING)
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GEOMANCERS_TRAINING), 'rechargeMultiplier')
    : duration;
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
    effect: { type: 'boon', name: 'Stability' },
    skillId: sourceId,
    skillName: 'Rock Solid',
    cast: emissionCast,
    priority: 0,
    attribution: { source: 'Trait', sourceId: TRAIT.ROCK_SOLID, actorType: 'player', name: 'Rock Solid', priority: 0 }
  });
}
