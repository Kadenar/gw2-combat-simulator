import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { conduitEntityModifierRules } from '#gw2/professions/revenant/specializations/conduit/skills/entity-skills.js';

export const conduitModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([...conduitEntityModifierRules]);

export const conduitModifiers = Object.freeze({
  modifierRules: conduitModifierRules
});
