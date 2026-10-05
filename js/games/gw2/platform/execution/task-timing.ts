import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { SkillTask } from '#gw2/platform/skills/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Scheduling and readiness use the same cast-relative deadline, clamped to the live clock. */
export function skillTaskAt(cast: RuntimeCast, trigger: SkillTask, now: number): number {
  const castTimeMs = Number(cast.skill.castTimeMs);
  const scale =
    trigger.timingScale === 'cast' && castTimeMs > 0 ? ((cast.fullEnd - cast.start) * 1000) / castTimeMs : 1;
  const origin =
    trigger.timingAnchor === 'castStart'
      ? cast.start
      : trigger.timingAnchor === 'castCommit'
        ? cast.effectiveEnd
        : cast.fullEnd;
  return canonicalTime(Math.max(now, origin + ((trigger.atMs ?? 0) * scale) / 1000));
}
