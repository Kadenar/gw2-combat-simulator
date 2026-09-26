import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorBoonActive, warriorEventSkill } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
export const warriorDisciplineModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.warriors-sprint',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => hasTrait(context, TRAIT.WARRIORS_SPRINT) && warriorBoonActive(context, 'swiftness')
  },
  {
    id: 'warrior.burst-mastery',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.BURST_MASTERY) && Boolean(warriorEventSkill(context)?.burst)
  }
]);
