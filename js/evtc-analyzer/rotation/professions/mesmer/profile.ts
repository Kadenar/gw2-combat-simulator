import type { ProfessionProfileSource } from "../../profiles.js";

export const mesmerProfileSource: ProfessionProfileSource = {
  id: "mesmer",
  name: "Mesmer",
  specializations: {
    core: "Core",
    chronomancer: "Chronomancer",
    mirage: "Mirage",
    virtuoso: "Virtuoso",
    troubadour: "Troubadour",
  },
  dodgeBySpecialization: {
    mirage: { name: "Dodge / Mirage Cloak", skillId: -1 },
    troubadour: { name: "Dodge", skillId: -5 },
  },
  aliases: {
    "mirage cloak": "Dodge / Mirage Cloak",
    dodge: "Dodge / Mirage Cloak",
  },
  skillIdAliasesBySpecialization: {
    chronomancer: {
      // The effect packet uses a different ID from the simulator skill.
      56925: 56930,
    },
    virtuoso: {
      // The current EVTC missile ID differs from the API skill ID.
      62586: 62617,
    },
  },
  // These actions emit several damage, missile, or buff packets per input.
  // Mesmer modules reconstruct one action from their authoritative signal.
  ignoredInstantSkillIds: [
    10190, 10191, 10192, 10202, 10234, 10287, 10310, 10331, 24755, 29830, 44677,
    56873, 56925, 56928, 56930, 62586, 62597, 62602, 62616, 62617, 68273,
  ],
  initialSummons: [
    {
      agentSpeciesId: 6621,
      action: { name: "Phantasmal Disenchanter", skillId: 10267 },
    },
    {
      agentSpeciesId: 6487,
      action: { name: "Phantasmal Swordsman", skillId: 10174 },
    },
    {
      agentSpeciesId: 5758,
      action: { name: "Phantasmal Duelist", skillId: 10175 },
    },
    {
      agentSpeciesId: 6449,
      action: { name: "Phantasmal Warlock", skillId: 10216 },
    },
  ],
  initialSummonsBySpecialization: {
    mirage: [
      {
        agentSpeciesId: 8111,
        action: { name: "Phase Retreat", skillId: 10310 },
      },
    ],
  },
};
