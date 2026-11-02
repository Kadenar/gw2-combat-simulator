/** Attribute modifier-only bonuses to their actual Mesmer skills; internal packet arithmetic is not a gameplay entry. */
import { modifierDescription, type ModifierDescriptions } from '#gw2/app/modifier-reference/presentation.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const mesmerModifierDescriptions: ModifierDescriptions = {
  'mesmer.event-final-multiplier': () => null,
  'mesmer.lute': modifierDescription({
    name: 'Lute Playing — damage bonus',
    skills: [ID.LIVELY_LUTE, ID.LIVELY_LUTE_ALTERNATE],
    description: 'Playing Lute increases your strike and condition damage. Illusion attacks do not receive this bonus.',
    facts: [['amount', 'Strike and condition damage while playing Lute']]
  }),
  'mesmer.mind-stab-vulnerability': modifierDescription({
    description:
      "Mind Stab gains an additional damage bonus per Vulnerability stack on the target. This multiplies separately from the target's ordinary Vulnerability bonus.",
    facts: [['damagePerStack', 'Additional strike damage per Vulnerability stack']]
  })
};
