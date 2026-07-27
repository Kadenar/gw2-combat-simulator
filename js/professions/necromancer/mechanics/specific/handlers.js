import { necromancerBlightSkillHandlers } from "./blight.js";
import { necromancerCoreSkillHandlers } from "./core.js";
import {
  handleNecromancerChillEvent,
  handleNecromancerStateEvent,
  handleNecromancerSummonAttack,
} from "./events.js";
import {
  advanceNecromancerState,
  applySkillLifeForceGain,
  finalizeNecromancerCast,
} from "./life-force.js";
import { necromancerMinionSkillHandlers } from "./minions.js";
import { gainNecromancerLifeForce } from "./shared.js";
import { necromancerShadeSkillHandlers } from "./shades.js";
import { necromancerShroudSkillHandlers } from "./shroud.js";
import { necromancerSpiritSkillHandlers } from "./spirits.js";

export {
  advanceNecromancerState,
  applySkillLifeForceGain,
  finalizeNecromancerCast,
  gainNecromancerLifeForce,
  handleNecromancerChillEvent,
  handleNecromancerStateEvent,
  handleNecromancerSummonAttack,
};

export const necromancerSkillHandlers = Object.freeze({
  ...necromancerShroudSkillHandlers,
  ...necromancerCoreSkillHandlers,
  ...necromancerMinionSkillHandlers,
  ...necromancerSpiritSkillHandlers,
  ...necromancerShadeSkillHandlers,
  ...necromancerBlightSkillHandlers,
});
