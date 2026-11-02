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
    description: 'The turret artifact temporarily increases player-owned strike damage.',
    facts: [['factor', 'Player strike damage while active', tooltipFactorChange]]
  }),
  'thief.malicious-backstab-position': modifierDescription({
    name: 'Malicious Backstab — positional bonus',
    skills: [ID.MALICIOUS_BACKSTAB],
    description:
      "Malicious Backstab receives its rear-position damage bonus when the simulator's defiant-target assumption is enabled.",
    facts: [['factor', 'Positional strike damage bonus', tooltipFactorChange]]
  }),
  // Skill-owned rules keep independent patch values while sharing their eligibility descriptions.
  ...Object.fromEntries(
    ['malicious-backstab-malice', 'malicious-deaths-judgment-malice'].map((skill) => [
      `thief.${skill}`,
      modifierDescription({
        description:
          'The attack gains strike damage per captured malice against the active mark. Its launched packet retains that value after malice is consumed.',
        facts: [['damagePerMalice', 'Strike damage per captured malice']]
      })
    ])
  ),
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
