import { flameJetModifier } from '#gw2/professions/engineer/core/skills/kits/flamethrower.js';

import {
  applyChemicalRoundsConditionDuration,
  applySharpshooterConditionAttributes
} from '#gw2/professions/engineer/core/traits/firearms/modifiers.js';

/** Flame Jet is the remaining skill-owned rule; trait definitions contribute all trait modifiers. */
export const engineerCoreModifiers = Object.freeze({
  modifyConditionAttributes: applySharpshooterConditionAttributes,
  modifyConditionBaseDuration: applyChemicalRoundsConditionDuration,
  modifierRules: [flameJetModifier]
});
