import type { ProfessionProfileSource } from "../../profiles.js";

export const elementalistProfileSource: ProfessionProfileSource = {
  id: "elementalist",
  name: "Elementalist",
  specializations: {
    core: "Core",
    tempest: "Tempest",
    weaver: "Weaver",
    catalyst: "Catalyst",
    evoker: "Evoker",
  },
  dodgeId: 1100277,
  skillIdAliasesBySpecialization: Object.fromEntries(
    ["core", "tempest", "weaver", "catalyst", "evoker"].map(
      (specialization) => [
        specialization,
        {
          // ArcDPS records the attunement-specific Glyph of Storms packets.
          5736: 1100122,
          5737: 1100124,
        },
      ],
    ),
  ),
  buffTransitions: [
    {
      buffSkillId: 5585,
      gain: { name: "Fire Attunement", skillId: 1100001 },
      suppressWeaponSwap: true,
    },
    {
      buffSkillId: 5586,
      gain: { name: "Water Attunement", skillId: 1100002 },
      suppressWeaponSwap: true,
    },
    {
      buffSkillId: 5575,
      gain: { name: "Air Attunement", skillId: 1100003 },
      suppressWeaponSwap: true,
    },
    {
      buffSkillId: 5580,
      gain: { name: "Earth Attunement", skillId: 1100004 },
      suppressWeaponSwap: true,
    },
  ],
};
