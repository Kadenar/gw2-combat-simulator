import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasSelectedSkillId, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicCombatContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { elementalistProfiledBuffRequest } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profile-ids.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistModifierContext,
  ElementalistResolverContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Earth definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const earthsEmbrace = defineTrait({
  id: TRAIT.EARTHS_EMBRACE,
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
  id: TRAIT.ELEMENTAL_SHIELDING,
  name: 'Elemental Shielding',
  balance: {
    effects: [{ type: 'boon', name: 'Protection', boon: 'protection', stacks: 1, duration: 3 }]
  }
});

export const earthenBlast = defineTrait({
  id: TRAIT.EARTHEN_BLAST,
  name: 'Earthen Blast',
  balance: {
    effects: [{ name: 'Earthen Blast', type: 'strike', coefficient: 0.36, hits: 1 }]
  }
});

export const strengthOfStone = defineTrait({
  id: TRAIT.STRENGTH_OF_STONE,
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
export function applyEarthsEmbrace(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const at = cast.effectiveEnd;
  if (skill.type !== 'Heal' || !hasTrait(context, TRAIT.EARTHS_EMBRACE)) return;
  const earthsEmbraceProfile = requireBalanceProfileFromContext(context, TRAIT.EARTHS_EMBRACE);
  // Claim the existing owner-local timer before any derived effect.
  if (!context.procs.claimCooldown('earthsEmbrace', at, balanceProfileNumber(earthsEmbraceProfile, 'internalCooldown')))
    return;
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      at,
      TRAIT.EARTHS_EMBRACE,
      'Resistance',
      "Earth's Embrace",
      skill.id,
      undefined,
      undefined,
      { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    )
  );
}

/** Applies Written in Stone's signet-specific aura after a completed signet cast. */
export function applyWrittenInStone(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  applyAura: ElementalistAuraApplier
): void {
  if (!hasTrait(context, TRAIT.WRITTEN_IN_STONE) || skill.skillFamily !== 'Signet') return;
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
    applyAura(context, {
      at: cast.effectiveEnd,
      aura: String(effect.kind),
      duration: effect.duration,
      skillName: 'Written in Stone',
      sourceId: skill.id
    });
  }
}

/** Applies Strength of Stone after an already-classified immobilize event. */
export function applyStrengthOfStone(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.STRENGTH_OF_STONE)) return;
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
    context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: event.at,
        source: 'Strength of Stone',
        sourceId: 'Strength of Stone',
        actorType: 'player',
        skillName: 'Strength of Stone',
        condition: String(bleeding.condition),
        stacks: Number(bleeding.stacks),
        duration: Number(bleeding.duration),
        triggeredBy: resolverSourceSkill(event)
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Strength of Stone', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
  }
}

/** Resolve Elemental Shielding's authored protection for the accepted aura reaction. */
function elementalShieldingEffect(context: unknown) {
  const elementalShieldingProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SHIELDING);
  const effect = requireEffect(elementalShieldingProfile, 'boon', 'Protection');
  if (!effect) return undefined;
  return {
    kind: String(effect.boon).toLowerCase(),
    stacks: Number(effect.stacks),
    duration: effect.duration
  };
}

/** Grants resolver-side Elemental Shielding protection for one classified aura event. */
export function applyResolverElementalShielding(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.ELEMENTAL_SHIELDING)) return;
  const protection = elementalShieldingEffect(context);
  if (!protection) return;
  context.effects.emit({
    kind: 'packet',
    durationContext: event,
    event: {
      type: 'buff',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.ELEMENTAL_SHIELDING,
      actorType: 'player',
      skillName: requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SHIELDING).name,
      kind: protection.kind.toLowerCase(),
      stacks: protection.stacks,
      duration: protection.duration,
      triggeredBy: resolverSourceSkill(event),
      priority: Number(event.priority || 0)
    }
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
