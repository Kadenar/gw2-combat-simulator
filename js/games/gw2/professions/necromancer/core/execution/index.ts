/**
 * Owns the Core Necromancer skill-handler registry and thin cast-phase routing.
 * Skill-family implementations remain in their named execution or mechanic owners.
 */
import { necromancerFlipSkillHandlers } from '#gw2/professions/necromancer/core/mechanics/skill-flips.js';
import { necromancerConditionSkillHandlers } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { necromancerMinionSkillHandlers } from '#gw2/professions/necromancer/core/mechanics/minions.js';
import { necromancerShroudSkillHandlers } from '#gw2/professions/necromancer/core/mechanics/shroud.js';
import { necromancerGreatswordSkillHandlers } from '#gw2/professions/necromancer/core/execution/greatsword.js';
import { necromancerSpearSkillHandlers } from '#gw2/professions/necromancer/core/execution/spear.js';
import { necromancerTorchSkillHandlers } from '#gw2/professions/necromancer/core/execution/torch.js';
import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
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
    beforeEffects: necromancerFlipSkillHandlers['necromancer.flip']
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
  'necromancer.minion-command': replaceSkill({
    beforeEffects: necromancerMinionSkillHandlers['necromancer.minion-command']
  }),
  'necromancer.summon-madness': replaceSkill({
    beforeEffects: necromancerMinionSkillHandlers['necromancer.summon-madness']
  }),
  'necromancer.deadly-slice': augmentSkill({
    afterEffects: necromancerSpearSkillHandlers['necromancer.deadly-slice']
  }),
  'necromancer.sinister-stab': augmentSkill({
    afterEffects: necromancerSpearSkillHandlers['necromancer.sinister-stab']
  }),
  'necromancer.chilling-scythe': augmentSkill({
    afterEffect: necromancerGreatswordSkillHandlers['necromancer.chilling-scythe']
  }),
  'necromancer.addle': augmentSkill({
    afterEffects: necromancerSpearSkillHandlers['necromancer.addle']
  }),
  'necromancer.extirpate': augmentSkill({
    afterEffect: necromancerSpearSkillHandlers['necromancer.extirpate']
  }),
  'necromancer.oppressive-collapse': augmentSkill({
    afterEffects: necromancerTorchSkillHandlers['necromancer.oppressive-collapse']
  }),
  'necromancer.perforate': augmentSkill({
    beforeEffects: necromancerSpearSkillHandlers['necromancer.perforate'].prepare,
    afterEffect: necromancerSpearSkillHandlers['necromancer.perforate'].afterEffect,
    afterEffects: necromancerSpearSkillHandlers['necromancer.perforate'].complete
  }),
  'necromancer.distress': replaceSkill({
    beforeEffects: necromancerSpearSkillHandlers['necromancer.distress']
  }),
  'necromancer.grasping-darkness': augmentSkill({
    resolveMode: (context, skill) =>
      necromancerGreatswordSkillHandlers['necromancer.grasping-darkness'].committed(context, skill)
        ? 'augment'
        : 'replace',
    afterEffect: necromancerGreatswordSkillHandlers['necromancer.grasping-darkness'].afterEffect
  }),
  'necromancer.nightfall': augmentSkill({
    resolveMode: (context, skill) =>
      necromancerGreatswordSkillHandlers['necromancer.nightfall'].committed(context, skill) ? 'augment' : 'replace',
    afterEffect: necromancerGreatswordSkillHandlers['necromancer.nightfall'].afterEffect
  })
});

/** Maps Core Necromancer handler IDs to the scheduler phases that implement each skill's runtime behavior. */
export const necromancerCoreSkillHandlers = new Map(Object.entries(handlers));
