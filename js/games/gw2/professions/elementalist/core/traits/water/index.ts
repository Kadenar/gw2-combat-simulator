import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
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
  id: TRAIT.SOOTHING_ICE,
  triggers: [onTriggerPoint(elementalistCastCompleted, { run: applySoothingIce })],
  name: 'Soothing Ice',
  balance: {
    internalCooldown: 15,
    effects: [
      { type: 'buff', name: 'Frost Aura', kind: 'Frost Aura', stacks: 1, duration: 4 },
      { type: 'boon', name: 'Regeneration', boon: 'regeneration', stacks: 1, duration: 4 }
    ]
  }
});

export const aquamancersTraining = defineTrait({
  id: TRAIT.AQUAMANCERS_TRAINING,
  name: "Aquamancer's Training",
  balance: {
    rechargeMultiplier: 0.8
  }
});

export const soothingPower = defineTrait({
  id: TRAIT.SOOTHING_POWER,
  name: 'Soothing Power',
  balance: { attributeBonus: 300 },
  buildAttributes: traitAttributeEffects(TRAIT.SOOTHING_POWER, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: false }
  ])
});

export const flowLikeWater = defineTrait({
  id: TRAIT.FLOW_LIKE_WATER,
  name: 'Flow like Water',
  modifierRules: [
    {
      order: -7,
      id: 'elementalist.flow-like-water',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

export const piercingShards = defineTrait({
  id: TRAIT.PIERCING_SHARDS,
  name: 'Piercing Shards',
  modifierRules: [
    {
      order: -5,
      id: 'elementalist.piercing-shards',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: { waterFactor: 1.14, otherFactor: 1.07 },
      factor: (context, _target, parameters) =>
        primaryAttunement(context) === 'Water' ? parameters.waterFactor : parameters.otherFactor,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Vulnerability')
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
  const soothingIceFrostAura = requireEffect(soothingIceProfile, 'buff', 'Frost Aura');
  if (soothingIceFrostAura) {
    applyElementalistAura(context, {
      at,
      aura: String(soothingIceFrostAura.kind),
      duration: soothingIceFrostAura.duration,
      skillName: 'Soothing Ice',
      sourceId: skill.id
    });
  }

  emitTraitProfile(context, TRAIT.SOOTHING_ICE, TRAIT.SOOTHING_ICE, undefined, {
    at: at,
    fullEnd: at,
    effect: { type: 'boon', name: 'Regeneration' },
    skillId: skill.id,
    skillName: 'Soothing Ice',
    cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
    priority: 0,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.SOOTHING_ICE,
      actorType: 'player',
      name: 'Soothing Ice',
      priority: 0
    }
  });
}

/** Scale this element's weapon recharge after the mechanic has handled held and non-weapon cooldowns. */
export function aquamancersTrainingRecharge(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  duration: number
): number {
  return skill.attunement === 'Water' && hasTrait(context, TRAIT.AQUAMANCERS_TRAINING)
    ? duration *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.AQUAMANCERS_TRAINING),
          'rechargeMultiplier'
        )
    : duration;
}
