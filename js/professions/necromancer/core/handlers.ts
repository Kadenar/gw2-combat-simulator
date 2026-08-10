import { necromancerCoreSkillHandlers as rawCoreHandlers } from "./actions.js";
import { necromancerConditionSkillHandlers } from "./conditions.js";
import { necromancerMinionSkillHandlers } from "./minions.js";
import { necromancerShroudSkillHandlers } from "./shroud.js";
import { necromancerWeaponSkillHandlers } from "./weapons.js";
import {
  augmentSkillHandler,
  replaceSkillHandler,
  skillHandler,
  SKILL_HANDLER_MODES,
} from "../../../platform/engine/skill-handlers.js";

const handlers = Object.freeze({
  "necromancer.shroud": replaceSkillHandler(
    necromancerShroudSkillHandlers["necromancer.shroud"],
  ),
  "necromancer.lich": replaceSkillHandler(
    necromancerShroudSkillHandlers["necromancer.lich"],
  ),
  "necromancer.weapon-swap": replaceSkillHandler(
    rawCoreHandlers["necromancer.weapon-swap"],
  ),
  "necromancer.flip": augmentSkillHandler(rawCoreHandlers["necromancer.flip"]),
  "necromancer.signet-vampirism": replaceSkillHandler(
    rawCoreHandlers["necromancer.signet-vampirism"],
  ),
  "necromancer.signet-undeath": replaceSkillHandler(
    rawCoreHandlers["necromancer.signet-undeath"],
  ),
  "necromancer.corruption": augmentSkillHandler(
    necromancerConditionSkillHandlers["necromancer.corruption"],
  ),
  "necromancer.condition-transfer": augmentSkillHandler(
    necromancerConditionSkillHandlers["necromancer.condition-transfer"],
  ),
  "necromancer.life-siphon": augmentSkillHandler(null, {
    afterEffect: necromancerConditionSkillHandlers["necromancer.life-siphon"],
  }),
  "necromancer.dark-pact": augmentSkillHandler(null, {
    afterEffect: necromancerConditionSkillHandlers["necromancer.dark-pact"],
  }),
  "necromancer.devouring-darkness": replaceSkillHandler(
    necromancerConditionSkillHandlers["necromancer.devouring-darkness"],
  ),
  "necromancer.minion": replaceSkillHandler(
    necromancerMinionSkillHandlers["necromancer.minion"],
  ),
  "necromancer.minion-command": replaceSkillHandler(
    necromancerMinionSkillHandlers["necromancer.minion-command"],
  ),
  "necromancer.summon-madness": replaceSkillHandler(
    necromancerMinionSkillHandlers["necromancer.summon-madness"],
  ),
  "necromancer.deadly-slice": augmentSkillHandler(null, {
    afterEffects: necromancerWeaponSkillHandlers["necromancer.deadly-slice"],
  }),
  "necromancer.sinister-stab": augmentSkillHandler(null, {
    afterEffects: necromancerWeaponSkillHandlers["necromancer.sinister-stab"],
  }),
  "necromancer.chilling-scythe": augmentSkillHandler(null, {
    afterEffect: necromancerWeaponSkillHandlers["necromancer.chilling-scythe"],
  }),
  "necromancer.addle": augmentSkillHandler(null, {
    afterEffects: necromancerWeaponSkillHandlers["necromancer.addle"],
  }),
  "necromancer.extirpate": augmentSkillHandler(null, {
    afterEffect: necromancerWeaponSkillHandlers["necromancer.extirpate"],
  }),
  "necromancer.oppressive-collapse": augmentSkillHandler(null, {
    afterEffects:
      necromancerWeaponSkillHandlers["necromancer.oppressive-collapse"],
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
    resolveMode: (context, skill) =>
      necromancerWeaponSkillHandlers["necromancer.grasping-darkness"].committed(
        context,
        skill,
      )
        ? SKILL_HANDLER_MODES.AUGMENT
        : SKILL_HANDLER_MODES.REPLACE,
    afterEffect:
      necromancerWeaponSkillHandlers["necromancer.grasping-darkness"]
        .afterEffect,
  }),
  "necromancer.nightfall": skillHandler({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: (context, skill) =>
      necromancerWeaponSkillHandlers["necromancer.nightfall"].committed(
        context,
        skill,
      )
        ? SKILL_HANDLER_MODES.AUGMENT
        : SKILL_HANDLER_MODES.REPLACE,
    afterEffect:
      necromancerWeaponSkillHandlers["necromancer.nightfall"].afterEffect,
  }),
});

export const necromancerCoreSkillHandlers = new Map(Object.entries(handlers));
