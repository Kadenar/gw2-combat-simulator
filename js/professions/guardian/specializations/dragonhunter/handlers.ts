import { reactToJusticeHitWithOptions } from "../../core/virtues.js";

export const dragonhunterEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: "guardian.dragonhunter.justice",
      order: 20,
      handler: reactToJusticeHitWithOptions,
    },
  ]),
});
