import type { StatusEffect } from '#gw2/platform/effects/types.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/skills/types.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

interface PassiveCouragePolicy {
  readonly taskId: string;
  readonly profileId: SkillId;
  readonly interval: (runtime: Runtime, profile: BalanceProfile) => number;
  readonly ready: (runtime: Runtime) => boolean;
  /** Specializations deliver their attributed Aegis through the shared runtime.effects service. */
  readonly deliver: (runtime: Runtime, profile: BalanceProfile, effect: StatusEffect) => void;
}

/** Dormancy skips delivery without shifting Courage's cadence; removed effects or disabled intervals stop it. */
export function createPassiveCourageTask(policy: PassiveCouragePolicy): (runtime: Runtime) => void {
  return (runtime) => {
    const profile = requireBalanceProfileFromContext(runtime, policy.profileId);
    const interval = policy.interval(runtime, profile);
    const effect = requireEffect(profile, 'boon', 'aegis');
    if (!(interval > 0) || !effect) return;
    if (policy.ready(runtime)) policy.deliver(runtime, profile, effect);
    runtime.schedule(policy.taskId, canonicalTime(runtime.time + interval), undefined, undefined, -200);
  };
}
