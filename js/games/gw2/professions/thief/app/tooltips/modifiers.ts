/** Name Thief buffs and shared malicious attack bonuses by their source rather than internal rule identifiers. */
import { modifierDescription, type ModifierDescriptions } from '#gw2/app/modifier-reference/presentation.js';
import { tooltipFactorChange } from '#gw2/app/shared/simulation-tooltip.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const thiefModifierDescriptions: ModifierDescriptions = {
  'thief.distracting-throw-finisher-strike': modifierDescription({
    name: 'Distracting Throw — damage buff',
    skills: [ID.DISTRACTING_THROW],
    description: 'The spear finisher grants a temporary bonus to player-owned strike and condition damage.',
    facts: [['amount', 'Strike damage while active']]
  }),
  'thief.distracting-throw-finisher-condition': modifierDescription({
    name: 'Distracting Throw — damage buff',
    skills: [ID.DISTRACTING_THROW],
    description: 'The spear finisher grants a temporary bonus to player-owned strike and condition damage.',
    facts: [['amount', 'Condition damage while active']]
  }),
  'thief.kryptis-turret-damage': modifierDescription({
    name: 'Summon Kryptis Turret — player damage bonus',
    skills: [ID.SUMMON_KRYPTIS_TURRET],
    description:
      'While the turret artifact buff lasts, player-owned strikes deal increased damage to targets the turret has hit.',
    facts: [['factor', 'Player strike damage while active', tooltipFactorChange]]
  }),
  'thief.malicious-backstab-position': modifierDescription({
    name: 'Malicious Backstab — positional bonus',
    skills: [ID.MALICIOUS_BACKSTAB],
    description:
      "Malicious Backstab receives its rear-position damage bonus when the simulator's defiant-target assumption is enabled.",
    facts: [['factor', 'Positional strike damage bonus', tooltipFactorChange]]
  }),
  'thief.malicious-backstab-malice': modifierDescription({
    description: 'Backstab gains strike damage for each stack of malice you have when it hits your mark.',
    facts: [['damagePerMalice', 'Strike damage per malice at impact']]
  }),
  'thief.malicious-deaths-judgment-malice': modifierDescription({
    description: 'The shot gains strike damage per malice held when it hits.',
    facts: [['damagePerMalice', 'Strike damage per malice at impact']]
  }),
  ...Object.fromEntries(
    ['shadow-flare-marked', 'shadow-swap-marked'].map((skill) => [
      `thief.${skill}`,
      modifierDescription({
        description: 'This skill deals increased player-owned strike damage against the active mark.',
        facts: [['factor', 'Strike damage against the marked target', tooltipFactorChange]]
      })
    ])
  )
};
