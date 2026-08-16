import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";

export const REAPER_MECHANICS = Object.freeze({
  traitProcs: Object.freeze({
    // Deathly Chill triggers on each Chill application, not on the chill tick — resolver fires this per-event.
    [TRAIT.DEATHLY_CHILL]: Object.freeze({
      name: "Deathly Chill",
      traitId: TRAIT.DEATHLY_CHILL,
      condition: "Bleeding",
      stacks: 4,
      duration: 4,
    }),
  }),
});
