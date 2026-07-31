import {
  handleNecromancerPainfulBond,
  handleNecromancerWeaponSpell,
} from "./events.js";
import { ritualistResolverEventReactions } from "./resolver.js";
import {
  necromancerSpiritSkillHandlers,
  ritualistSchedulerHooks,
} from "./spirits.js";
import { necromancerWeaponSpellSkillHandlers } from "./weapon-spells.js";
import { replaceSkillHandler } from "../../../../platform/engine/skill-handlers.js";

export const ritualistSkillHandlers = new Map([
  [
    "necromancer.ritualist",
    replaceSkillHandler(
      necromancerSpiritSkillHandlers["necromancer.ritualist"],
    ),
  ],
  [
    "necromancer.innervate",
    replaceSkillHandler(
      necromancerSpiritSkillHandlers["necromancer.innervate"],
    ),
  ],
  [
    "necromancer.weapon-spell",
    replaceSkillHandler(
      necromancerWeaponSpellSkillHandlers["necromancer.weapon-spell"],
    ),
  ],
]);

export const ritualistEventHandlers = Object.freeze(
  {
    "necromancer.painful-bond": handleNecromancerPainfulBond,
    "necromancer.weapon-spell": handleNecromancerWeaponSpell,
  },
);

export const ritualistEventReactions = ritualistResolverEventReactions;

export { ritualistSchedulerHooks };
