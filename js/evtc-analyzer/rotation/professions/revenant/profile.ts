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
  skillIdAliasesBySpecialization: {
    // Cosmic Wisdom changes the combat-log IDs without changing the player's
    // Demon-legend inputs; replay them through the simulator's base skills.
    conduit: {
      78191: 28287,
      78203: 27917,
      78351: 76503,
      78587: 27505
    }
  },
  // Song of the Mists and Invoke Torment packets are legend-swap trait
  // effects, and Conduit's Dervish attacks are Cosmic Wisdom outputs, not
  // separate player inputs.
  ignoredInstantSkillIds: [28625, 46843, 46847, 46849, 46854, 46856, 46857, 59591, 62705, 76818, 77116],
  // Some golem EVTCs begin with initial state and omit ENTER_COMBAT. That
  // initial-state timestamp is the same combat boundary exposed by EI.
  inferCombatStartFromFirstCast: true
};
