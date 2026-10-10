import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

import { ghastlyClawsVulnerabilityModifier } from '#gw2/professions/necromancer/core/skills/weapons/axe.js';
import { lifeSiphonBleedingModifier } from '#gw2/professions/necromancer/core/skills/weapons/dagger.js';
import { modifyNecromancerConditionBaseDuration } from '#gw2/professions/necromancer/core/traits/curses/modifiers.js';

const necromancerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  { ...lifeSiphonBleedingModifier, order: -20 },
  { ...ghastlyClawsVulnerabilityModifier, order: 108 }
]);

export const necromancerCoreModifiers = Object.freeze({
  modifyConditionBaseDuration: modifyNecromancerConditionBaseDuration,
  modifierRules: necromancerCoreModifierRules
});
