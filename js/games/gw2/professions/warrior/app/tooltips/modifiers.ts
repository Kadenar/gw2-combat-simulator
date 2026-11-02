/** Burst and weapon bonuses expose their actual target requirements rather than internal rule suffixes. */
import { modifierDescription, type ModifierDescriptions } from '#gw2/app/modifier-reference/presentation.js';
import { tooltipFactorChange } from '#gw2/app/shared/simulation-tooltip.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const warriorModifierDescriptions: ModifierDescriptions = {
  'warrior.kill-shot-threshold': modifierDescription({
    name: 'Kill Shot — defiant or low-health target',
    skills: [ID.KILL_SHOT],
    description: 'Kill Shot gains strike damage when the target is defiant or below 50% health.',
    facts: [['factor', 'Strike damage against an eligible target', tooltipFactorChange]]
  }),
  'warrior.wastrels-ruin-defiant': modifierDescription({
    name: "Wastrel's Ruin — defiant target",
    skills: [ID.WASTRELS_RUIN],
    description: "Wastrel's Ruin receives its increased strike damage when the simulator's target is defiant.",
    facts: [['factor', 'Strike damage against a defiant target', tooltipFactorChange]]
  }),
  'warrior.breaching-strike-boonless': modifierDescription({
    name: 'Breaching Strike — boonless-target bonus',
    description: "Breaching Strike receives its increased damage against the simulator's boonless target.",
    facts: [['factor', 'Strike damage against a boonless target', tooltipFactorChange]]
  })
};
