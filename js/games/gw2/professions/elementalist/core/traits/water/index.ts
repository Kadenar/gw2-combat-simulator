import { AURA, ACTOR, CONDITION, BOON } from '#gw2/platform/constants.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { primaryAttunement } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import {
  elementalistCastCompleted,
  type ElementalistCastCompleted
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Water definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const soothingIce = defineTrait({
  name: 'Soothing Ice',
  id: TRAIT.SOOTHING_ICE,
  balance: {
    internalCooldown: 15,
    effects: [
      { type: 'aura', name: AURA.FROST, aura: AURA.FROST, duration: 4 },
      { type: 'boon', name: BOON.REGENERATION, boon: BOON.REGENERATION, stacks: 1, duration: 4 }
    ]
  },
  triggers: [onTriggerPoint(elementalistCastCompleted, { run: applySoothingIce })]
});

export const aquamancersTraining = defineTrait({
  name: "Aquamancer's Training",
  id: TRAIT.AQUAMANCERS_TRAINING,
  balance: {
    rechargeMultiplier: 0.8
  },
  // Only this element's weapon skills receive the selected profile's persistent recharge multiplier.
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.type === 'Weapon' && skill.attunement === 'Water',
      multiplier: { profile: TRAIT.AQUAMANCERS_TRAINING, field: 'rechargeMultiplier' }
    }
  ]
});

export const soothingPower = defineTrait({
  name: 'Soothing Power',
  id: TRAIT.SOOTHING_POWER,
  balance: { attributeBonus: 300 },
  attributes: traitAttributeEffects(TRAIT.SOOTHING_POWER, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: 'none' }
  ])
});

export const flowLikeWater = defineTrait({
  name: 'Flow like Water',
  id: TRAIT.FLOW_LIKE_WATER,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1 },
  modifierRules: [
    {
      order: -7,
      id: 'elementalist.flow-like-water',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.FLOW_LIKE_WATER, 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

export const piercingShards = defineTrait({
  name: 'Piercing Shards',
  id: TRAIT.PIERCING_SHARDS,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { waterFactor: 1.14, otherFactor: 1.07 },
  modifierRules: [
    {
      order: -5,
      id: 'elementalist.piercing-shards',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',

      factor: (context) =>
        primaryAttunement(context) === 'Water'
          ? balanceNumberFromContext(context, TRAIT.PIERCING_SHARDS, 'waterFactor')
          : balanceNumberFromContext(context, TRAIT.PIERCING_SHARDS, 'otherFactor'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, CONDITION.VULNERABILITY)
    }
  ]
});

/** Applies Soothing Ice's Frost Aura and regeneration from an eligible healing skill. */
function applySoothingIce(context: ElementalistRuntime, { cast }: ElementalistCastCompleted): void {
  const skill = cast.skill;
  const at = cast.effectiveEnd;

  if (skill.type !== 'Heal') {
    return;
  }

  const soothingIceProfile = requireBalanceProfileFromContext(context, TRAIT.SOOTHING_ICE);

  // Claim the existing owner-local timer before any derived effect.
  if (!context.procs.claimCooldown('soothingIce', at, balanceProfileNumber(soothingIceProfile, 'internalCooldown')))
    return;

  const soothingIceFrostAura = requireEffect(soothingIceProfile, 'aura', AURA.FROST);

  if (soothingIceFrostAura) {
    applyElementalistAura(context, {
      at,
      aura: soothingIceFrostAura.aura,
      duration: soothingIceFrostAura.duration,
      skillName: 'Soothing Ice',
      sourceId: skill.id
    });
  }

  emitTraitProfile(context, TRAIT.SOOTHING_ICE, TRAIT.SOOTHING_ICE, undefined, {
    at: at,
    fullEnd: at,
    effect: { type: 'boon', name: BOON.REGENERATION },
    skillId: skill.id,
    skillName: 'Soothing Ice',
    cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
    priority: 0,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.SOOTHING_ICE,
      actorType: ACTOR.PLAYER,
      name: 'Soothing Ice',
      priority: 0
    }
  });
}
