import {
  augmentSkill,
  replaceSkill,
} from "../../../platform/gw2/native-profession.js";
import {
  handleVirtueActivation,
  handleVirtueRefresh,
  guardianVirtueSkillHandlers,
  reactToJusticeHit,
} from "./virtues.js";
import {
  reactToGuardianBuffTraits,
  reactToGuardianDamageTraits,
  handleRighteousInstinctsTick,
} from "./traits.js";
import { guardianWeaponSkillHandlers } from "./weapon-state.js";

export const guardianCoreSkillHandlers = Object.freeze({
  "guardian.virtue": augmentSkill({
    beforeEffects: guardianVirtueSkillHandlers["guardian.virtue"],
  }),
  "guardian.renewed-focus": replaceSkill({
    beforeEffects: guardianVirtueSkillHandlers["guardian.renewed-focus"],
  }),
  "guardian.weapon-swap": replaceSkill({
    beforeEffects: guardianWeaponSkillHandlers["guardian.weapon-swap"],
  }),
});

export const guardianCoreEventHandlers = Object.freeze({
  "guardian.virtue-activated": handleVirtueActivation,
  "guardian.virtues-refreshed": handleVirtueRefresh,
  "guardian.righteous-instincts-tick": handleRighteousInstinctsTick,
});

export const guardianCoreEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: "guardian.traits",
      order: 15,
      handler: reactToGuardianDamageTraits,
    },
    {
      id: "guardian.justice",
      order: 20,
      handler: reactToJusticeHit,
    },
  ]),
  buff: Object.freeze([
    {
      id: "guardian.traits",
      order: 10,
      handler: reactToGuardianBuffTraits,
    },
  ]),
});
