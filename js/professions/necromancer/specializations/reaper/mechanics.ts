import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";

export const REAPER_MECHANICS = Object.freeze({
  traitProcs: Object.freeze({
    [TRAIT.DEATHLY_CHILL]: Object.freeze({
      name: "Deathly Chill",
      traitId: TRAIT.DEATHLY_CHILL,
      condition: "Bleeding",
      stacks: 4,
      duration: 4,
    }),
  }),
});
