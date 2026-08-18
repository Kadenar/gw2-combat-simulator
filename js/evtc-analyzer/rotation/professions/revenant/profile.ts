import type { ProfessionProfileSource } from '../../profiles.js';

export const revenantProfileSource: ProfessionProfileSource = {
  id: 'revenant',
  name: 'Revenant',
  specializations: {
    core: 'Core',
    herald: 'Herald',
    renegade: 'Renegade',
    vindicator: 'Vindicator',
    conduit: 'Conduit'
  },
  aliases: {
    'legend swap': 'Swap Legends'
  },
  // Song of the Mists and Invoke Torment packets are legend-swap trait
  // effects, not separate player inputs.
  ignoredInstantSkillIds: [28625, 46843, 46847, 46849, 46854, 46856, 46857, 59591, 62705]
};
