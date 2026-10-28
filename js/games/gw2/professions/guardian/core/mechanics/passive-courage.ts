import { boonKey } from '#gw2/platform/combat/boons.js';
import { BOON } from '#gw2/platform/constants.js';
import type { StatusEffect } from '#gw2/platform/effects/types.js';
import { requireEffect, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { GuardianRuntime } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

interface PassiveCouragePolicy {
  readonly taskId: string;
  readonly skillId: SkillId;
  readonly interval: (runtime: GuardianRuntime, skill: Skill) => number;
  readonly ready: (runtime: GuardianRuntime) => boolean;
  /** Specializations deliver their attributed Aegis through the shared runtime.effects service. */
  readonly deliver: (runtime: GuardianRuntime, skill: Skill, effect: StatusEffect) => void;
}

/** Dormancy skips delivery without shifting Courage's cadence; removed effects or disabled intervals stop it. */
export function createPassiveCourageTask(policy: PassiveCouragePolicy): (runtime: GuardianRuntime) => void {
  return (runtime) => {
    const skill = requireSkillFromContext(runtime, policy.skillId);
    const interval = policy.interval(runtime, skill);
    const effect = requireEffect(skill, 'boon', boonKey(BOON.AEGIS));

    if (!(interval > 0) || !effect) return;

    if (policy.ready(runtime)) policy.deliver(runtime, skill, effect);

    runtime.schedule(policy.taskId, canonicalTime(runtime.time + interval), undefined, undefined, -200);
  };
}
