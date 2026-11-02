/** Use Flame Wheel's player-facing skill identity for the hammer's fire-orb bonus. */
import { modifierDescription, type ModifierDescriptions } from '#gw2/app/modifier-reference/presentation.js';

export const elementalistModifierDescriptions: ModifierDescriptions = {
  'elementalist.hammer-fire-orb-strike': modifierDescription({
    name: 'Flame Wheel — damage bonus',
    description:
      "Flame Wheel's active fire orb increases strike and condition damage. The bonus ends when the orb expires or is consumed by Grand Finale.",
    facts: [['amount', 'Strike damage while the fire orb is active']]
  }),
  'elementalist.hammer-fire-orb-condition': modifierDescription({
    name: 'Flame Wheel — damage bonus',
    description:
      "Flame Wheel's active fire orb increases strike and condition damage. The bonus ends when the orb expires or is consumed by Grand Finale.",
    facts: [['amount', 'Condition damage while the fire orb is active']]
  })
};
