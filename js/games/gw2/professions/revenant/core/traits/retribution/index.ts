import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Owns Dwarven Battle Training tuning and behavior at its established execution boundaries. */
export const dwarvenBattleTraining = defineTrait({
  id: TRAIT.DWARVEN_BATTLE_TRAINING,
  name: 'Dwarven Battle Training',
  balance: {
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'Weakness',
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  modifierRules: [
    {
      id: 'revenant.dwarven-battle-training',
      order: 3,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Weakness')
    }
  ],
  triggers: [
    {
      on: 'control.resolved',
      when: () => true,
      emit: TRAIT.DWARVEN_BATTLE_TRAINING,
      effects: (effect) => effect.type === 'condition' && effect.name === 'Weakness',
      attribution: {
        source: 'revenant',
        sourceId: TRAIT.DWARVEN_BATTLE_TRAINING,
        actorType: 'player',
        skillId: TRAIT.DWARVEN_BATTLE_TRAINING,
        skillName: 'Dwarven Battle Training',
        name: 'Dwarven Battle Training — Weakness'
      }
    }
  ]
});

/** Owns Enduring Recovery tuning and behavior at its established execution boundaries. */
export const enduringRecovery = defineTrait({
  id: TRAIT.ENDURING_RECOVERY,
  name: 'Enduring Recovery',
  balance: {
    enduranceRegenerationMultiplier: 1.25,
    effects: []
  }
});

/** Owns Versed in Stone tuning and behavior at its established execution boundaries. */
export const versedInStone = defineTrait({
  buildAttributes: traitAttributeEffects(TRAIT.VERSED_IN_STONE, [
    {
      kind: 'conversion',
      from: 'Toughness',
      to: 'Power',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'common'
    }
  ]),
  id: TRAIT.VERSED_IN_STONE,
  name: 'Versed in Stone',
  balance: { attributeConversion: 0.13 }
});

/** Owns Vicious Reprisal tuning and behavior at its established execution boundaries. */
export const viciousReprisalTrait = defineTrait({
  id: TRAIT.VICIOUS_REPRISAL,
  name: 'Vicious Reprisal',
  balance: {
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 1,
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  modifierRules: [
    {
      id: 'revenant.vicious-reprisal',
      order: 4,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && boonActive(context, 'resolution')
    }
  ]
});

/** Vicious Reprisal grants Might from landed strikes while Resolution is active, once per its cooldown. */
export function viciousReprisal(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  // Permanent configured Resolution and executed self applications count; pending packets never do.
  if (
    !hasTrait(runtime, TRAIT.VICIOUS_REPRISAL) ||
    runtime.combat.activeBoonStacks('resolution', runtime.time, 1) === 0
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.VICIOUS_REPRISAL);
  const boon = requireEffect(profile, 'boon', 'might');
  // The cooldown gates only might, so a removed boon leaves it ready.
  if (!boon) return;
  if (!runtime.procs.claimCooldown('viciousReprisal', runtime.time, balanceProfileNumber(profile, 'cooldown'))) return;
  // Keep its position among resolved-hit traits while sharing profile expansion and causal placement.
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: [{ ...boon, name: 'Vicious Reprisal — might' }],
    attribution: (effect) => ({
      source: 'revenant',
      sourceId: TRAIT.VICIOUS_REPRISAL,
      actorType: effect.actorType || 'player',
      skillId: profile.id,
      skillName: profile.name
    }),
    skillWeaponFallback: 'Unequipped',
    cause: event
  });
}

/** Supplies the additive Enduring Recovery rate before the shared cap. */
export function enduringRecoveryBonus(runtime: RevenantRuntime): number {
  const enduring = hasTrait(runtime, TRAIT.ENDURING_RECOVERY)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, TRAIT.ENDURING_RECOVERY),
        'enduranceRegenerationMultiplier'
      ) - 1
    : 0;
  return enduring;
}
