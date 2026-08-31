/** Registers scheduler-phase skill activations for this module. */
import { necromancerCoreSkillHandlers as rawCoreHandlers } from '#gw2/content/professions/necromancer/core/skills/flip-handlers.js';
import { necromancerConditionSkillHandlers } from '#gw2/content/professions/necromancer/core/mechanics/conditions.js';
import { necromancerMinionSkillHandlers } from '#gw2/content/professions/necromancer/core/mechanics/minions.js';
import { necromancerShroudSkillHandlers } from '#gw2/content/professions/necromancer/core/mechanics/shroud.js';
import { necromancerWeaponSkillHandlers } from '#gw2/content/professions/necromancer/core/skills/weapons.js';
import { augmentSkill, replaceSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';

const handlers = Object.freeze({
  'necromancer.shroud': replaceSkill({
    beforeEffects: necromancerShroudSkillHandlers['necromancer.shroud']
  }),
  'necromancer.lich': replaceSkill({
    beforeEffects: necromancerShroudSkillHandlers['necromancer.lich']
  }),
  'necromancer.weapon-swap': gw2WeaponSwapSkillHandler,
  'necromancer.flip': augmentSkill({
    beforeEffects: rawCoreHandlers['necromancer.flip']
  }),
  'necromancer.corruption': augmentSkill({
    beforeEffects: necromancerConditionSkillHandlers['necromancer.corruption']
  }),
  'necromancer.condition-transfer': augmentSkill({
    beforeEffects: necromancerConditionSkillHandlers['necromancer.condition-transfer']
  }),
  'necromancer.life-siphon': augmentSkill({
    afterEffect: necromancerConditionSkillHandlers['necromancer.life-siphon']
  }),
  'necromancer.dark-pact': augmentSkill({
    afterEffect: necromancerConditionSkillHandlers['necromancer.dark-pact']
  }),
  'necromancer.devouring-darkness': replaceSkill({
    beforeEffects: necromancerConditionSkillHandlers['necromancer.devouring-darkness']
  }),
  'necromancer.minion': replaceSkill({
    beforeEffects: necromancerMinionSkillHandlers['necromancer.minion']
  }),
  'necromancer.minion-command': augmentSkill({
    resolveMode: () => 'replace',
    beforeEffects: necromancerMinionSkillHandlers['necromancer.minion-command']
  }),
  'necromancer.summon-madness': augmentSkill({
    resolveMode: () => 'replace',
    beforeEffects: necromancerMinionSkillHandlers['necromancer.summon-madness']
  }),
  'necromancer.deadly-slice': augmentSkill({
    afterEffects: necromancerWeaponSkillHandlers['necromancer.deadly-slice']
  }),
  'necromancer.sinister-stab': augmentSkill({
    afterEffects: necromancerWeaponSkillHandlers['necromancer.sinister-stab']
  }),
  'necromancer.chilling-scythe': augmentSkill({
    afterEffect: necromancerWeaponSkillHandlers['necromancer.chilling-scythe']
  }),
  'necromancer.addle': augmentSkill({
    afterEffects: necromancerWeaponSkillHandlers['necromancer.addle']
  }),
  'necromancer.extirpate': augmentSkill({
    afterEffect: necromancerWeaponSkillHandlers['necromancer.extirpate']
  }),
  'necromancer.oppressive-collapse': augmentSkill({
    afterEffects: necromancerWeaponSkillHandlers['necromancer.oppressive-collapse']
  }),
  'necromancer.perforate': augmentSkill({
    beforeEffects: necromancerWeaponSkillHandlers['necromancer.perforate'].prepare,
    afterEffect: necromancerWeaponSkillHandlers['necromancer.perforate'].afterEffect,
    afterEffects: necromancerWeaponSkillHandlers['necromancer.perforate'].complete
  }),
  'necromancer.distress': replaceSkill({
    beforeEffects: necromancerWeaponSkillHandlers['necromancer.distress']
  }),
  'necromancer.grasping-darkness': augmentSkill({
    resolveMode: (context, skill) =>
      necromancerWeaponSkillHandlers['necromancer.grasping-darkness'].committed(context, skill) ? 'augment' : 'replace',
    afterEffect: necromancerWeaponSkillHandlers['necromancer.grasping-darkness'].afterEffect
  }),
  'necromancer.nightfall': augmentSkill({
    resolveMode: (context, skill) =>
      necromancerWeaponSkillHandlers['necromancer.nightfall'].committed(context, skill) ? 'augment' : 'replace',
    afterEffect: necromancerWeaponSkillHandlers['necromancer.nightfall'].afterEffect
  })
});

/** Maps Core Necromancer handler IDs to the scheduler phases that implement each skill's runtime behavior. */
export const necromancerCoreSkillHandlers = new Map(Object.entries(handlers));
