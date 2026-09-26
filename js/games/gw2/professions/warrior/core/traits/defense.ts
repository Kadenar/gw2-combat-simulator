import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  warriorBoonActive,
  warriorEventSkill,
  warriorTargetControlled
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
export const warriorDefenseModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.cull-the-weak',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.CULL_THE_WEAK) && targetConditionActive(context, 'Weakness')
  },
  {
    id: 'warrior.merciless-hammer',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.MERCILESS_HAMMER) &&
      ['Hammer', 'Mace'].includes(
        String(
          context.event?.skillWeapon ||
            warriorEventSkill(context)?.skillWeapon ||
            warriorEventSkill(context)?.weapon ||
            ''
        )
      ) &&
      warriorTargetControlled(context)
  },
  {
    id: 'warrior.stalwart-strength',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.STALWART_STRENGTH) && warriorBoonActive(context, 'stability')
  }
]);
