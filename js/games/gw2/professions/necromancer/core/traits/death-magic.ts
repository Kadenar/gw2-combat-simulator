import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyDarkDefense } from '#gw2/professions/necromancer/core/traits/carapace.js';

/** Owns Necromantic Corruption tuning and behavior at its existing execution boundaries. */
export const necromanticCorruption = defineTrait({
  id: TRAIT.NECROMANTIC_CORRUPTION,
  name: 'Necromantic Corruption',
  balance: { damageMultiplier: 1.25 },
  modifierRules: [
    {
      order: 109,
      id: 'necromancer.necromantic-corruption',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.NECROMANTIC_CORRUPTION),
          'damageMultiplier'
        ),
      when: (context) => context.event?.summonKind === 'minion' && hasTrait(context, TRAIT.NECROMANTIC_CORRUPTION)
    }
  ]
});

/** Owns Flesh of the Master tuning and behavior at its existing execution boundaries. */
export const fleshOfTheMaster = defineTrait({
  id: TRAIT.FLESH_OF_THE_MASTER,
  name: 'Flesh of the Master',
  balance: {
    resourceGain: 2,
    maximumStacks: 30
  }
});

/** Owns Deadly Strength tuning and behavior at its existing execution boundaries. */
export const deadlyStrength = defineTrait({
  id: TRAIT.DEADLY_STRENGTH,
  name: 'Deadly Strength',
  balance: { attributePerStack: 10 }
});

/** Owns Corrupter's Fervor tuning and behavior at its existing execution boundaries. */
export const corruptersFervor = defineTrait({
  id: TRAIT.CORRUPTERS_FERVOR,
  name: "Corrupter's Fervor",
  balance: { resourceGain: 1, duration: 10 }
});

/** Owns Dark Defense tuning and behavior at its existing execution boundaries. */
export const darkDefense = defineTrait({
  id: TRAIT.DARK_DEFENSE,
  name: 'Dark Defense',
  balance: {
    resourceGain: 10,
    duration: 10,
    internalCooldown: 5,
    effects: [{ name: 'protection', type: 'boon', boon: 'protection', stacks: 1, duration: 3 }]
  },
  hooks: { onCastCommit: applyDarkDefense }
});

/** Owns Shrouded Removal tuning and behavior at its existing execution boundaries. */
export const shroudedRemoval = defineTrait({
  id: TRAIT.SHROUDED_REMOVAL,
  name: 'Shrouded Removal',
  balance: { maximumConditions: 1, resourceGain: 3, duration: 10 }
});

/** Owns Soul Comprehension tuning and behavior at its existing execution boundaries. */
export const soulComprehension = defineTrait({
  id: TRAIT.SOUL_COMPREHENSION,
  name: 'Soul Comprehension',
  balance: { lifeForcePerStack: 0.5, maximumStacks: 30 }
});

/** Owns Armored Shroud tuning and behavior at its existing execution boundaries. */
export const armoredShroud = defineTrait({
  id: TRAIT.ARMORED_SHROUD,
  name: 'Armored Shroud',
  balance: { resourceGain: 5, duration: 10 }
});

/** Owns Putrid Defense tuning and behavior at its existing execution boundaries. */
export const putridDefense = defineTrait({
  id: TRAIT.PUTRID_DEFENSE,
  name: 'Putrid Defense',
  modifierRules: [
    {
      order: 110,
      id: 'necromancer.putrid-defense',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      when: (context) => context.condition === 'Poisoned' && hasTrait(context, TRAIT.PUTRID_DEFENSE)
    }
  ]
});

export const deathMagicTraits = [
  necromanticCorruption,
  fleshOfTheMaster,
  deadlyStrength,
  corruptersFervor,
  darkDefense,
  shroudedRemoval,
  soulComprehension,
  armoredShroud,
  putridDefense
];
