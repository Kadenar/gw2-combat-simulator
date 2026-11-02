/** Name Thief buffs and shared malicious attack bonuses by their source rather than internal rule identifiers. */
import { modifierDescription, type ModifierDescriptions } from '#gw2/app/modifier-reference/presentation.js';
import { tooltipFactorChange } from '#gw2/app/shared/simulation-tooltip.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const thiefModifierDescriptions: ModifierDescriptions = {
  'thief.distracting-throw-finisher': modifierDescription({
    name: 'Distracting Throw — damage buff',
    skills: [ID.DISTRACTING_THROW],
    description: 'The spear finisher grants a temporary bonus to player-owned strike and condition damage.',
    facts: [['amount', 'Strike and condition damage while active']]
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
  'thief.malicious-stealth-attack': modifierDescription({
    name: "Malice — Backstab and Death's Judgment",
    skills: [ID.MALICIOUS_BACKSTAB, ID.MALICIOUS_DEATHS_JUDGMENT],
    category: 'weapon',
    description:
      "Malicious Backstab and Malicious Death's Judgment gain strike damage per consumed malice when attacking the marked target. The launched attack retains the malice consumed by its cast.",
    facts: [['damagePerMalice', 'Strike damage per consumed malice']]
  }),
  'thief.shadow-flare-marked': modifierDescription({
    name: 'Shadow Flare / Shadow Swap — marked target',
    skills: [ID.SHADOW_FLARE, ID.SHADOW_SWAP],
    category: 'utility',
    description: 'Shadow Flare and its Shadow Swap follow-up deal increased strike damage to the marked target.',
    facts: [['factor', 'Strike damage against the marked target', tooltipFactorChange]]
  })
};
