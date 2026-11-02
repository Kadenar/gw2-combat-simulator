/** Shared Ranger buffs retain all skill sources and recipient differences instead of borrowing one variant's tooltip. */
import { modifierDescription, type ModifierDescriptions } from '#gw2/app/modifier-reference/presentation.js';
import { tooltipFactorChange } from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const rangerModifierDescriptions: ModifierDescriptions = {
  'ranger.attack-of-opportunity': modifierDescription({
    name: 'Attack of Opportunity',
    skills: [ID.MAUL_BASE, ID.MAUL_SOULBEAST],
    description:
      "Maul empowers the pet's next direct attack, or your own next direct attack while merged as a Soulbeast. Trait and stance damage cannot consume the charge.",
    facts: [
      ['petFactor', 'Pet next-attack damage', tooltipFactorChange],
      ['playerFactor', 'Merged-player next-attack damage', tooltipFactorChange]
    ]
  }),
  'ranger.force-of-nature': modifierDescription({
    name: 'Force of Nature — mace damage buff',
    category: 'weapon',
    skills: [ID.CULTIVATE, ID.FLOURISH, ID.OAKEN_CUDGEL, ID.THISTLEGUARD, ID.WILD_STRIKES],
    description:
      "Mace attacks build Nature's Strength. Consuming five stacks grants Force of Nature, increasing your strike damage even after a weapon swap. Pets do not receive this bonus.",
    facts: [['factor', 'Player strike damage during Force of Nature', tooltipFactorChange]]
  }),
  'ranger.piercing-gales-vulnerability': modifierDescription({
    name: 'Piercing Gales — additional Vulnerability scaling',
    skills: [ID.PIERCING_GALES],
    description:
      "Piercing Gales gains additional strike damage per Vulnerability stack. Its own bonus multiplies separately from the target's ordinary Vulnerability bonus.",
    facts: [['vulnerabilityPerStack', 'Additional strike damage per Vulnerability stack']]
  }),
  'ranger.sic-em-pet': modifierDescription({
    name: "“Sic 'Em!”",
    skills: [ID.SIC_EM],
    qualifier: 'Pet',
    description: "“Sic 'Em!” temporarily increases the pet's strike damage.",
    facts: [['factor', 'Pet strike damage', tooltipFactorChange]]
  }),
  'ranger.sic-em-player': modifierDescription({
    name: "“Sic 'Em!”",
    skills: [ID.SIC_EM],
    qualifier: 'Merged Soulbeast',
    description: 'While merged as a Soulbeast, the command instead grants the player its merged strike-damage bonus.',
    facts: [['factor', 'Merged-player strike damage', tooltipFactorChange]]
  })
};
