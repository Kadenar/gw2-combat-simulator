import type { EvtcProfessionProfileSource } from '../../profiles.js';

export const revenantProfileSource: EvtcProfessionProfileSource = {
  professionId: 'revenant',
  // Song of the Mists and Invoke Torment packets are legend-swap trait
  // effects, and Conduit's Dervish attacks are Cosmic Wisdom outputs, not
  // separate player inputs.
  ignoredInstantSkillIds: [28625, 46843, 46847, 46849, 46854, 46856, 46857, 59591, 62705, 76818, 77116],
  // Some golem EVTCs begin with initial state and omit ENTER_COMBAT. That
  // initial-state timestamp is the same combat boundary exposed by EI.
  inferCombatStartFromFirstCast: true
};
