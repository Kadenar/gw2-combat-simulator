import {
  augmentSkill,
  replaceSkill,
} from "../../../../platform/gw2/native-profession.js";
import {
  guardianRadiantForgeEventHandlers,
  guardianRadiantForgeSkillHandlers,
} from "./radiant-forge.js";
import {
  handleEffulgentActivated,
  handleEffulgentDetonate,
  reactToEffulgentStrike,
  reactToLuminaryJusticeHit,
} from "./traits.js";

export const luminarySkillHandlers = Object.freeze({
  "guardian.radiant-forge": replaceSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers["guardian.radiant-forge"],
  }),
  "guardian.radiant-weapon": augmentSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers["guardian.radiant-weapon"],
  }),
  "guardian.glaring-burst": replaceSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers["guardian.glaring-burst"],
  }),
});

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
