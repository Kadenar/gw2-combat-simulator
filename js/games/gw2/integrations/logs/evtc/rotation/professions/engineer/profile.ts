import type { EvtcProfessionProfileSource } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';

export const engineerProfileSource: EvtcProfessionProfileSource = {
  professionId: 'engineer',
  // Passive packets such as Static Discharge and Aim-Assisted Rocket are scheduled effects, not player inputs.
  // Specialization modules reconstruct any owning actions.
  ignoredInstantSkillIds: [13552, 29889, 41612, 43630, 43937, 45119, 59562, 70303, 76640, 77104, 77163],
  inferCombatStartFromFirstCast: true
};
