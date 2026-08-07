import {
  augmentSkill,
  replaceSkill,
} from "../../../../platform/gw2/native-profession.js";
import {
  guardianTomeEventHandlers,
  guardianTomeSkillHandlers,
  reactToAshesHit,
} from "./tomes.js";
import {
  handleFirebrandVirtueActivation,
  reactToFirebrandBuffTraits,
  reactToFirebrandJusticeHit,
} from "./traits.js";

export const firebrandSkillHandlers = Object.freeze({
  "guardian.stow-tome": replaceSkill({
    beforeEffects: guardianTomeSkillHandlers["guardian.stow-tome"],
  }),
  "guardian.tome-page": augmentSkill({
    beforeEffects: guardianTomeSkillHandlers["guardian.tome-page"],
  }),
});

export const firebrandEventHandlers = Object.freeze({
  ...guardianTomeEventHandlers,
  "guardian.firebrand-virtue-activated": handleFirebrandVirtueActivation,
});

export const firebrandEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: "guardian.ashes-of-the-just",
      order: 10,
      handler: reactToAshesHit,
    },
    {
      id: "guardian.firebrand.justice",
      order: 20,
      handler: reactToFirebrandJusticeHit,
    },
  ]),
  buff: Object.freeze([
    {
      id: "guardian.firebrand.traits",
      order: 5,
      handler: reactToFirebrandBuffTraits,
    },
  ]),
});
