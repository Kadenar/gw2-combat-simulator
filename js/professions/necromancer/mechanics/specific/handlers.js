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
import { necromancerConditionSkillHandlers } from "./conditions.js";
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
import { gainNecromancerLifeForce, hasTrait } from "./shared.js";
import { necromancerShadeSkillHandlers } from "./shades.js";
import { necromancerShroudSkillHandlers } from "./shroud.js";
import { necromancerSpiritSkillHandlers } from "./spirits.js";
import { necromancerWeaponSkillHandlers } from "./weapons.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  augmentSkillHandler,
  replaceSkillHandler,
  skillHandler,
  SKILL_HANDLER_MODES,
} from "../../../../platform/engine/skill-handlers.js";

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
  "necromancer.shroud": replaceSkillHandler(
    necromancerShroudSkillHandlers["necromancer.shroud"],
  ),
  "necromancer.lich": replaceSkillHandler(
    necromancerShroudSkillHandlers["necromancer.lich"],
  ),
  "necromancer.executioners-scythe": augmentSkillHandler(null, {
    afterEffect:
      necromancerShroudSkillHandlers["necromancer.executioners-scythe"],
  }),
  "necromancer.soul-spiral": augmentSkillHandler(null, {
    afterEffect:
      necromancerShroudSkillHandlers["necromancer.soul-spiral"],
  }),
  "necromancer.weapon-swap": replaceSkillHandler(
    necromancerCoreSkillHandlers["necromancer.weapon-swap"],
  ),
  "necromancer.flip": augmentSkillHandler(
    necromancerCoreSkillHandlers["necromancer.flip"],
  ),
  "necromancer.signet-vampirism": replaceSkillHandler(
    necromancerCoreSkillHandlers["necromancer.signet-vampirism"],
  ),
  "necromancer.signet-undeath": replaceSkillHandler(
    necromancerCoreSkillHandlers["necromancer.signet-undeath"],
  ),
  "necromancer.corruption": augmentSkillHandler(
    necromancerConditionSkillHandlers["necromancer.corruption"],
  ),
  "necromancer.condition-transfer": augmentSkillHandler(
    necromancerConditionSkillHandlers["necromancer.condition-transfer"],
  ),
  "necromancer.life-siphon": augmentSkillHandler(null, {
    afterEffect:
      necromancerConditionSkillHandlers["necromancer.life-siphon"],
  }),
  "necromancer.dark-pact": augmentSkillHandler(null, {
    afterEffect:
      necromancerConditionSkillHandlers["necromancer.dark-pact"],
  }),
  "necromancer.devouring-darkness": replaceSkillHandler(
    necromancerConditionSkillHandlers["necromancer.devouring-darkness"],
  ),
  "necromancer.dark-barrage": skillHandler({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: (context) =>
      hasTrait(context, TRAIT.DOOM_APPROACHES)
        ? SKILL_HANDLER_MODES.REPLACE
        : SKILL_HANDLER_MODES.AUGMENT,
    beforeEffects:
      necromancerConditionSkillHandlers["necromancer.dark-barrage"],
  }),
  "necromancer.minion": replaceSkillHandler(
    necromancerMinionSkillHandlers["necromancer.minion"],
  ),
  "necromancer.minion-command": replaceSkillHandler(
    necromancerMinionSkillHandlers["necromancer.minion-command"],
  ),
  "necromancer.summon-madness": replaceSkillHandler(
    necromancerMinionSkillHandlers["necromancer.summon-madness"],
  ),
  "necromancer.ritualist": replaceSkillHandler(
    necromancerSpiritSkillHandlers["necromancer.ritualist"],
  ),
  "necromancer.innervate": replaceSkillHandler(
    necromancerSpiritSkillHandlers["necromancer.innervate"],
  ),
  "necromancer.shade": replaceSkillHandler(
    necromancerShadeSkillHandlers["necromancer.shade"],
  ),
  "necromancer.elixir": replaceSkillHandler(
    necromancerBlightSkillHandlers["necromancer.elixir"],
  ),
  "necromancer.blight-skill": replaceSkillHandler(
    necromancerBlightSkillHandlers["necromancer.blight-skill"],
  ),
  "necromancer.deadly-slice": augmentSkillHandler(null, {
    afterEffects: necromancerWeaponSkillHandlers["necromancer.deadly-slice"],
  }),
  "necromancer.sinister-stab": augmentSkillHandler(null, {
    afterEffects: necromancerWeaponSkillHandlers["necromancer.sinister-stab"],
  }),
  "necromancer.chilling-scythe": augmentSkillHandler(null, {
    afterEffect:
      necromancerWeaponSkillHandlers["necromancer.chilling-scythe"],
  }),
  "necromancer.addle": augmentSkillHandler(null, {
    afterEffects: necromancerWeaponSkillHandlers["necromancer.addle"],
  }),
  "necromancer.extirpate": augmentSkillHandler(null, {
    afterEffect: necromancerWeaponSkillHandlers["necromancer.extirpate"],
  }),
  "necromancer.perforate": augmentSkillHandler(
    necromancerWeaponSkillHandlers["necromancer.perforate"].prepare,
    {
      afterEffect:
        necromancerWeaponSkillHandlers["necromancer.perforate"].afterEffect,
      afterEffects:
        necromancerWeaponSkillHandlers["necromancer.perforate"].complete,
    },
  ),
  "necromancer.distress": replaceSkillHandler(
    necromancerWeaponSkillHandlers["necromancer.distress"],
  ),
  "necromancer.grasping-darkness": skillHandler({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: (context, skill) => (
      necromancerWeaponSkillHandlers["necromancer.grasping-darkness"]
        .committed(context, skill)
        ? SKILL_HANDLER_MODES.AUGMENT
        : SKILL_HANDLER_MODES.REPLACE
    ),
    afterEffect:
      necromancerWeaponSkillHandlers["necromancer.grasping-darkness"]
        .afterEffect,
  }),
  "necromancer.nightfall": skillHandler({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: (context, skill) => (
      necromancerWeaponSkillHandlers["necromancer.nightfall"]
        .committed(context, skill)
        ? SKILL_HANDLER_MODES.AUGMENT
        : SKILL_HANDLER_MODES.REPLACE
    ),
    afterEffect:
      necromancerWeaponSkillHandlers["necromancer.nightfall"].afterEffect,
  }),
});
