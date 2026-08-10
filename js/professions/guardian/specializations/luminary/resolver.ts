import { guardianRadiantForgeEventHandlers } from "./radiant-forge.js";
import {
  handleEffulgentActivated,
  handleEffulgentDetonate,
  reactToEffulgentStrike,
  reactToLuminaryJusticeHit,
} from "./traits.js";

export const luminaryEventHandlers = Object.freeze({
  ...guardianRadiantForgeEventHandlers,
  "guardian.effulgent-activated": handleEffulgentActivated,
  "guardian.effulgent-detonate": handleEffulgentDetonate,
});

export const luminaryEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: "guardian.luminary.effulgent",
      order: 16,
      handler: reactToEffulgentStrike,
    },
    {
      id: "guardian.luminary.justice",
      order: 20,
      handler: reactToLuminaryJusticeHit,
    },
  ]),
});
