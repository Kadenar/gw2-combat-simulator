import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";

export const DAREDEVIL_DODGE_EFFECTS = Object.freeze({
  "Bounding Dodger": Object.freeze([
    Object.freeze({
      type: "strike",
      sourceId: TRAIT.BOUNDING_DODGER,
      coefficient: 1.33,
      hits: 1,
    }),
  ]),
  "Lotus Training": Object.freeze([
    Object.freeze({
      type: "condition",
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: "Bleeding",
      stacks: 1,
      duration: 4,
    }),
    Object.freeze({
      type: "condition",
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: "Torment",
      stacks: 1,
      duration: 4,
    }),
    Object.freeze({
      type: "condition",
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: "Crippled",
      stacks: 1,
      duration: 2,
    }),
  ]),
  "Unhindered Combatant": Object.freeze([
    Object.freeze({
      type: "boon",
      sourceId: TRAIT.UNHINDERED_COMBATANT,
      boon: "Swiftness",
      stacks: 1,
      duration: 8,
    }),
  ]),
});
