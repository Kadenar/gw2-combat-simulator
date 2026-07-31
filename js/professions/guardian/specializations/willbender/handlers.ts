import { reactToJusticeHitWithOptions } from "../../core/virtues.js";

export const willbenderEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: "guardian.willbender.justice",
      order: 20,
      handler: reactToJusticeHitWithOptions,
    },
  ]),
});
