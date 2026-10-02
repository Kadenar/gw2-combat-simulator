import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { emitEngineerEvent } from '#gw2/professions/engineer/core/events.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';
/** Recharge reductions operate on live remaining work, including ammo recharge, and report only effective changes. */
export function reduceEngineerRecharge(
  runtime: EngineerRuntime,
  cast: RuntimeCast<EngineerSkill>,
  predicate: (skill: EngineerSkill) => boolean,
  seconds: number,
  sourceId: number | string,
  name: string
): void {
  let reducedBy = 0;
  for (const skill of runtime.helpers.skillsById.values())
    if (predicate(skill)) reducedBy += runtime.cooldownController.reduceSkillRecharge(skill, seconds, runtime.time);
  if (reducedBy > 0)
    emitEngineerEvent(runtime, 'proc', {
      at: runtime.time,
      source: sourceId === cast.skill.id ? 'engineer' : 'Trait',
      sourceId,
      name,
      procType: sourceId === cast.skill.id ? 'skill' : 'trait',
      sourceSkill: cast.skill.name,
      cooldownReduction: reducedBy
    });
}
