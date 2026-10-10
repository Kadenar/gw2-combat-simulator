import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import {
  anguishConditionModifier,
  essenceBlastSpiritModifier
} from '#gw2/professions/necromancer/specializations/ritualist/skills/index.js';

const ritualistModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  { ...essenceBlastSpiritModifier, order: 0 },
  { ...anguishConditionModifier, order: 2 }
]);

export const ritualistModifiers = Object.freeze({
  modifierRules: ritualistModifierRules
});
