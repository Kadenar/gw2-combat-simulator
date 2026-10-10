import { flameJetModifier } from '#gw2/professions/engineer/core/skills/kits/flamethrower.js';

/** Flame Jet is the remaining skill-owned rule; trait definitions contribute all trait modifiers. */
export const engineerCoreModifiers = Object.freeze({
  modifierRules: [flameJetModifier]
});
