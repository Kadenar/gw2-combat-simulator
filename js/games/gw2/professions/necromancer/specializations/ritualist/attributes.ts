/** Ritualist attribute replacements for spirit strikes that carry a fixed Power. */
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';

/** Apply the attack's authored Power override after player bonuses, preserving all other attributes. */
export const ritualistSpiritAttributes: Gw2AttributeContributionCalculator = ({ event }) =>
  event?.type === 'damage' && event.metadata?.ritualistPowerOverride !== undefined
    ? [
        {
          transforms: [
            { kind: 'project', replace: false, attributes: { power: event.metadata.ritualistPowerOverride } }
          ]
        }
      ]
    : [];
