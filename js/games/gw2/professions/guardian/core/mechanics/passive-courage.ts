import { BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import type { StatusEffect } from '#gw2/platform/effects/types.js';

import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/skills/types.js';
import type { GuardianRuntime } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

interface PassiveCouragePolicy {
  readonly taskId: string;
  readonly profileId: SkillId;
  readonly interval: (runtime: GuardianRuntime, profile: BalanceProfile) => number;
  readonly ready: (runtime: GuardianRuntime) => boolean;
  /** Specializations deliver their attributed Aegis through the shared runtime.effects service. */
  readonly deliver: (runtime: GuardianRuntime, profile: BalanceProfile, effect: StatusEffect) => void;
}

/** Dormancy skips delivery without shifting Courage's cadence; removed effects or disabled intervals stop it. */
export function createPassiveCourageTask(policy: PassiveCouragePolicy): (runtime: GuardianRuntime) => void {
  return (runtime) => {
    const profile = requireBalanceProfileFromContext(runtime, policy.profileId);
    const interval = policy.interval(runtime, profile);
    const effect = requireEffect(profile, 'boon', boonKey(BOON.AEGIS));

    if (!(interval > 0) || !effect) return;

    if (policy.ready(runtime)) policy.deliver(runtime, profile, effect);

    runtime.schedule(policy.taskId, canonicalTime(runtime.time + interval), undefined, undefined, -200);
  };
}
