import { ACTOR } from '#gw2/platform/constants.js';
import { toolbeltActivated } from '#gw2/professions/engineer/core/mechanics/trigger-points.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Detects explicit specialization toolbelt skills and ordinary parent-linked toolbelt skills. */
export function isEngineerToolbeltSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.countsAsToolbeltSkill ?? Boolean(skill?.toolbeltParentId);
}

/** Every toolbelt entry path fires the same point at the live clock; other skills are not toolbelt activations. */
export function notifyToolbeltActivation(runtime: EngineerRuntime, skill: EngineerSkill): void {
  if (!isEngineerToolbeltSkill(skill)) return;

  const at = runtime.time;
  runtime.fireTrigger(toolbeltActivated, {
    skill,
    at,
    cause: {
      type: 'action',
      at,
      source: 'engineer',
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillId: skill.id,
      skillName: skill.name
    }
  });
}
