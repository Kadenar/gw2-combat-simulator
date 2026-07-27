/**
 * Aggregator for the necromancer's "specific" mechanics layer.
 *
 * Merges every per-category skill-handler map (shroud, core, condition, minion,
 * spirit, shade, blight) into the single `necromancerSkillHandlers` table keyed
 * by mechanic id, and re-exports the resolver/scheduler event handlers and the
 * life-force helpers. This is the only module the rest of the profession needs
 * to import from `specific/`.
 */
import { necromancerBlightSkillHandlers } from "./blight.js";
import { necromancerCoreSkillHandlers } from "./core.js";
import {
  necromancerConditionSkillHandlers,
} from "./conditions.js";
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
  ...necromancerConditionSkillHandlers,
  ...necromancerMinionSkillHandlers,
  ...necromancerSpiritSkillHandlers,
  ...necromancerShadeSkillHandlers,
  ...necromancerBlightSkillHandlers,
});
