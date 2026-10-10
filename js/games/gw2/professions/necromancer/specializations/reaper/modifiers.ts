import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

import { reaperShoutMeleeModifier } from '#gw2/professions/necromancer/specializations/reaper/skills/shout-skills.js';

export const reaperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  { ...reaperShoutMeleeModifier, order: 0 }
]);

export const reaperModifiers = Object.freeze({
  modifierRules: reaperModifierRules
});
