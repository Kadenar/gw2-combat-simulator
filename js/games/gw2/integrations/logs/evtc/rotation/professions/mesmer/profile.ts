import type { EvtcProfessionProfileSource } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';

export const mesmerProfileSource: EvtcProfessionProfileSource = {
  professionId: 'mesmer',
  // These actions emit several damage, missile, or buff packets per input.
  // Mesmer modules reconstruct one action from their authoritative signal.
  ignoredInstantSkillIds: [
    10190, 10191, 10192, 10202, 10234, 10287, 10310, 10331, 24755, 29830, 44677, 56873, 56925, 56928, 56930, 62586,
    62597, 62602, 62616, 62617, 68273
  ],
  initialSummons: [
    {
      agentSpeciesId: 6621,
      action: { name: 'Phantasmal Disenchanter', skillId: 10267 }
    },
    {
      agentSpeciesId: 6487,
      action: { name: 'Phantasmal Swordsman', skillId: 10174 }
    },
    {
      agentSpeciesId: 5758,
      action: { name: 'Phantasmal Duelist', skillId: 10175 }
    },
    {
      agentSpeciesId: 6449,
      action: { name: 'Phantasmal Warlock', skillId: 10216 }
    }
  ],
  initialSummonsBySpecialization: {
    mirage: [
      {
        agentSpeciesId: 8111,
        action: { name: 'Phase Retreat', skillId: 10310 }
      }
    ]
  }
};
