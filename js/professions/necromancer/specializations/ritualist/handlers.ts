import { necromancerSpiritSkillHandlers } from "./spirits.js";
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
