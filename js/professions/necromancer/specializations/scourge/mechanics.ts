import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";

export const SCOURGE_MECHANICS = Object.freeze({
  traitProcs: Object.freeze({
    [TRAIT.DEMONIC_LORE]: Object.freeze({
      name: "Demonic Lore",
      traitId: TRAIT.DEMONIC_LORE,
      condition: "Burning",
      duration: 1,
      interval: 3,
    }),
  }),
  shade: Object.freeze({
    manifest: Object.freeze({
      coefficient: 0.666,
      condition: Object.freeze(["Torment", 1, 2]),
      duration: 15,
      sandSavantDuration: 8,
    }),
    abrasiveGrit: Object.freeze({
      mightDuration: 6,
      mightStacks: 2,
    }),
    desertEmpowerment: Object.freeze({
      alacrityDuration: 1.5,
    }),
    sadisticSearing: Object.freeze({
      condition: Object.freeze(["Burning", 1, 4]),
    }),
    garishPillar: Object.freeze({ fearDuration: 1 }),
    desertShroud: Object.freeze({
      coefficient: 3.15,
      hits: 7,
      interval: 1,
      condition: Object.freeze(["Torment", 1, 5]),
    }),
    sandstormShroud: Object.freeze({
      coefficient: 3,
      delay: 3.5,
      condition: Object.freeze(["Torment", 6, 5]),
      pulseCount: 3,
      pulseInterval: 1,
      pulseProtectionDuration: 1.5,
      detonationProtectionDuration: 3,
    }),
  }),
});
