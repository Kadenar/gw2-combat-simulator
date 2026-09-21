/**
 * Owns the Core Necromancer skill-handler registry and thin cast-phase routing.
 * Skill-family implementations remain in their named execution or mechanic owners.
 */
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/family-state.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { necromancerConditionSkillHandlers } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { necromancerMinionSkillHandlers } from '#gw2/professions/necromancer/core/mechanics/minions.js';
import { necromancerShroudSkillHandlers } from '#gw2/professions/necromancer/core/mechanics/shroud.js';
import { necromancerGreatswordSkillHandlers } from '#gw2/professions/necromancer/core/execution/greatsword.js';
import { necromancerSpearSkillHandlers } from '#gw2/professions/necromancer/core/execution/spear.js';
import { necromancerTorchSkillHandlers } from '#gw2/professions/necromancer/core/execution/torch.js';
import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';

/** Completed shroud attacks expose their authored follow-up lifetime; interrupted parents grant nothing. */
function completeFlip(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  if (castWasInterrupted(context)) return false;
  const flips = professionCoreState(context).availableFlips;
  if (skill.flipSkillId != null) {
    const duration = skill.id === ID.DARK_PATH ? 3 : skill.id === ID.INFUSING_TERROR ? 6 : 12;
    armSkillFlip(flips, skill.flipSkillId, context.effectiveEnd, context.effectiveEnd + duration);
  }

  if (skill.flipParentId != null) consumeSkillFlip(flips, skill.id);
  emitNecromancerStateSnapshot(context, context.effectiveEnd, 'flip', { dedupeAcrossSourceIds: true });
  return false;
}

const handlers = Object.freeze({
  'necromancer.shroud': replaceSkill({
    beforeEffects: necromancerShroudSkillHandlers['necromancer.shroud']
  }),
  'necromancer.lich': replaceSkill({
    beforeEffects: necromancerShroudSkillHandlers['necromancer.lich']
  }),
  'necromancer.weapon-swap': gw2WeaponSwapSkillHandler,
  'necromancer.flip': augmentSkill({
    beforeEffects: completeFlip
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
    afterEffect: necromancerSpearSkillHandlers['necromancer.perforate']
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
    afterEffect: necromancerGreatswordSkillHandlers['necromancer.nightfall'].afterEffect
  })
});

/** Maps Core Necromancer handler IDs to the scheduler phases that implement each skill's runtime behavior. */
export const necromancerCoreSkillHandlers = new Map(Object.entries(handlers));
