/** Radiant Forge modifiers identify the actual strike and the weapon state that enables its bonus. */
import { modifierDescription, type ModifierDescriptions } from '#gw2/app/modifier-reference/presentation.js';
import { tooltipFactorChange } from '#gw2/app/shared/simulation-tooltip.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const guardianModifierDescriptions: ModifierDescriptions = {
  'guardian.glaring-burst-hammer': modifierDescription({
    name: 'Glaring Burst — radiant hammer bonus',
    skills: [ID.GLARING_BURST],
    description: 'Glaring Burst deals increased strike damage when its packet uses the radiant hammer variant.',
    facts: [['factor', 'Strike damage with the radiant hammer', tooltipFactorChange]]
  })
};
