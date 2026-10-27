import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
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
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { battleScarConsumed, type RevenantStrike } from '#gw2/professions/revenant/core/mechanics/trigger-points.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Owns Dwarven Battle Training tuning and behavior at its established execution boundaries. */
export const dwarvenBattleTraining = defineTrait({
  name: 'Dwarven Battle Training',
  id: TRAIT.DWARVEN_BATTLE_TRAINING,
  balance: {
    damageMultiplier: 1.1,
    effects: [
      {
        name: CONDITION.WEAKNESS,
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  modifierRules: [
    {
      id: 'revenant.dwarven-battle-training',
      order: 3,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.DWARVEN_BATTLE_TRAINING, 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, CONDITION.WEAKNESS)
    }
  ],
  triggers: [
    {
      on: 'control.resolved',
      when: () => true,
      emit: TRAIT.DWARVEN_BATTLE_TRAINING,
      effects: (effect) => effect.type === 'condition' && effect.name === CONDITION.WEAKNESS,
      attribution: {
        source: 'revenant',
        sourceId: TRAIT.DWARVEN_BATTLE_TRAINING,
        actorType: ACTOR.PLAYER,
        skillId: TRAIT.DWARVEN_BATTLE_TRAINING,
        skillName: 'Dwarven Battle Training',
        name: 'Dwarven Battle Training — Weakness'
      }
    }
  ]
});

/** Owns Enduring Recovery tuning and behavior at its established execution boundaries. */
export const enduringRecovery = defineTrait({
  name: 'Enduring Recovery',
  id: TRAIT.ENDURING_RECOVERY,
  balance: {
    enduranceRegenerationMultiplier: 1.25,
    effects: []
  }
});

/** Owns Versed in Stone tuning and behavior at its established execution boundaries. */
export const versedInStone = defineTrait({
  name: 'Versed in Stone',
  id: TRAIT.VERSED_IN_STONE,
  balance: { attributeConversion: 0.13 },
  attributes: traitAttributeEffects(TRAIT.VERSED_IN_STONE, [
    {
      kind: 'conversion',
      from: 'Toughness',
      to: 'Power',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'common'
    }
  ])
});

/** Owns Vicious Reprisal tuning and behavior at its established execution boundaries. */
export const viciousReprisalTrait = defineTrait({
  name: 'Vicious Reprisal',
  id: TRAIT.VICIOUS_REPRISAL,
  balance: {
    damageIncrease: 0.1,
    conditionDamageIncrease: 0.1,
    cooldown: 1,
    effects: [
      {
        name: boonKey(BOON.MIGHT),
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 1,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  modifierRules: [
    {
      id: 'revenant.vicious-reprisal',
      order: 4,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: (context, target) =>
        target === MODIFIER_TARGET.CONDITION_DAMAGE
          ? balanceNumberFromContext(context, TRAIT.VICIOUS_REPRISAL, 'conditionDamageIncrease')
          : balanceNumberFromContext(context, TRAIT.VICIOUS_REPRISAL, 'damageIncrease'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && boonActive(context, boonKey(BOON.RESOLUTION))
    }
  ],
  triggers: [onTriggerPoint(battleScarConsumed, { run: viciousReprisal })]
});

/** Vicious Reprisal grants Might from landed strikes while Resolution is active, once per its cooldown. */
function viciousReprisal(runtime: RevenantRuntime, { cause: event }: RevenantStrike): void {
  // Permanent configured Resolution and executed self applications count; pending packets never do.
  if (runtime.combat.activeBoonStacks(boonKey(BOON.RESOLUTION), runtime.time, 1) === 0) return;

  const profile = requireBalanceProfileFromContext(runtime, TRAIT.VICIOUS_REPRISAL);
  const boon = requireEffect(profile, 'boon', boonKey(BOON.MIGHT));

  // The cooldown gates only might, so a removed boon leaves it ready.
  if (!boon) return;

  if (!runtime.procs.claimCooldown('viciousReprisal', runtime.time, balanceProfileNumber(profile, 'cooldown'))) return;

  // Keep its position among resolved-hit traits while sharing profile expansion and causal placement.
  // The boon packet stays unlabelled, so reports name it by its boon and trait attribution.
  emitTraitProfile(runtime, TRAIT.VICIOUS_REPRISAL, profile.id, event, {
    preserveName: true,
    effects: (effect) => effect === boon,
    attribution: (effect) => ({
      source: 'revenant',
      sourceId: TRAIT.VICIOUS_REPRISAL,
      actorType: effect.actorType || ACTOR.PLAYER,
      skillId: profile.id,
      skillName: profile.name
    }),
    skillWeaponFallback: 'Unequipped'
  });
}

/** Supplies the additive Enduring Recovery rate before the shared cap. */
export function enduringRecoveryBonus(runtime: RevenantRuntime): number {
  const enduring = hasTrait(runtime, TRAIT.ENDURING_RECOVERY)
    ? balanceNumberFromContext(runtime, TRAIT.ENDURING_RECOVERY, 'enduranceRegenerationMultiplier') - 1
    : 0;
  return enduring;
}
