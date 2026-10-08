import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { elementalistProfiledBuffRequest } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { primaryAttunement } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Water definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const soothingIce = defineTrait({
  id: TRAIT.SOOTHING_ICE,
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
export function applySoothingIce(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  applyAura: ElementalistAuraApplier
): void {
  const at = cast.effectiveEnd;
  if (skill.type !== 'Heal' || !hasTrait(context, TRAIT.SOOTHING_ICE)) {
    return;
  }

  const soothingIceProfile = requireBalanceProfileFromContext(context, TRAIT.SOOTHING_ICE);
  // Claim the existing owner-local timer before any derived effect.
  if (!context.procs.claimCooldown('soothingIce', at, balanceProfileNumber(soothingIceProfile, 'internalCooldown')))
    return;
  const soothingIceFrostAura = requireEffect(soothingIceProfile, 'buff', 'Frost Aura');
  if (soothingIceFrostAura) {
    applyAura(context, {
      at,
      aura: String(soothingIceFrostAura.kind),
      duration: soothingIceFrostAura.duration,
      skillName: 'Soothing Ice',
      sourceId: skill.id
    });
  }

  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      at,
      TRAIT.SOOTHING_ICE,
      'Regeneration',
      'Soothing Ice',
      skill.id,
      undefined,
      undefined,
      { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    )
  );
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
