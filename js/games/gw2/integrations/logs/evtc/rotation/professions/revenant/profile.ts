import type { EvtcProfessionProfileSource } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';

export const revenantProfileSource: EvtcProfessionProfileSource = {
  professionId: 'revenant',
  // Song of the Mists and Invoke Torment packets are legend-swap trait
  // effects, while Conduit's Dervish attacks and spear mines are generated
  // outputs rather than separate player inputs.
  ignoredInstantSkillIds: [28625, 46843, 46847, 46849, 46854, 46856, 46857, 59591, 62705, 73149, 76818, 77116],
  // Some golem EVTCs begin with initial state and omit ENTER_COMBAT. That
  // initial-state timestamp is the same combat boundary exposed by EI.
  inferCombatStartFromFirstCast: true
};
