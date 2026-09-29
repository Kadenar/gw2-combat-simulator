import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { reaperShoutMeleeModifier } from '#gw2/professions/necromancer/specializations/reaper/skills/shout-skills.js';
import { modifyReapersOnslaughtAttributes } from '#gw2/professions/necromancer/specializations/reaper/traits/behavior.js';

/** Applies Reaper's Onslaught ferocity while Reaper Shroud is active. */
function modifyReaperAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  modifyReapersOnslaughtAttributes(context, result);

  return result;
}

export const reaperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  { ...reaperShoutMeleeModifier, order: 0 }
]);

export const reaperModifiers = Object.freeze({
  modifyAttributes: modifyReaperAttributes,
  modifierRules: reaperModifierRules
});
