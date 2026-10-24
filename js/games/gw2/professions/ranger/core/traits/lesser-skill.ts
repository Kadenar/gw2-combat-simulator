import { ACTOR } from '#gw2/platform/constants.js';
import { invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Claim the lesser skill's shared recharge before emitting its effects, retaining the triggering action as cause. */
export function invokeLesserRangerSkill(
  context: RangerRuntime,
  skill: RangerSkill,
  trait: SkillId,
  lesserSkillId: SkillId
): void {
  const proc = context.helpers.skillsById.get(lesserSkillId)!;

  if (!proc.effects?.length || context.cooldownController.isOnCooldown(proc.id, context.time)) return;

  context.cooldownController.startRecharge(proc, context.time);
  invokeTraitSkill(context, trait, proc.id, {
    type: 'action',
    source: 'Trait',
    sourceId: proc.id,
    at: context.time,
    skillId: skill.id,
    skillName: skill.name,
    actorType: ACTOR.PLAYER
  });
}
