import { guardianRadiantForgeSkillHandlers } from "./radiant-forge.js";
import { guardianTomeSkillHandlers } from "./tomes.js";
import { guardianVirtueSkillHandlers } from "./virtues.js";
import { guardianWeaponSkillHandlers } from "./weapon-state.js";

export const guardianSkillHandlers = Object.freeze({
  ...guardianVirtueSkillHandlers,
  ...guardianTomeSkillHandlers,
  ...guardianRadiantForgeSkillHandlers,
  ...guardianWeaponSkillHandlers,
});
