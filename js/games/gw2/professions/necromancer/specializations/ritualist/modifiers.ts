import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import {
  anguishConditionModifier,
  essenceBlastSpiritModifier
} from '#gw2/professions/necromancer/specializations/ritualist/skills/index.js';
import { modifyBoonOfCreationAttributes } from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';

// Apply Ritualist's build-time concentration bonus without double-counting pre-applied static rules.
function modifyRitualistAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  modifyBoonOfCreationAttributes(context, result);

  return result;
}

const ritualistModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  { ...essenceBlastSpiritModifier, order: 0 },
  { ...anguishConditionModifier, order: 2 }
]);

export const ritualistModifiers = Object.freeze({
  modifyAttributes: modifyRitualistAttributes,
  modifierRules: ritualistModifierRules
});
