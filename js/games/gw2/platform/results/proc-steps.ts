import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import type { AnnouncementEmission } from '#gw2/platform/effects/emission.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';

/** Project an executed announcement into the timeline without introducing a combat packet or consuming RNG identity. */
export function recordProcStep(
  context: Pick<Gw2ResolverRuntime, 'reporting' | 'procKeys' | 'procSteps' | 'effectRecorder' | 'deathTime'>,
  announcement: AnnouncementEmission['announcement']
): void {
  const {
    type,
    name,
    at,
    sourceSkill = '',
    detail = '',
    icon = '',
    cooldownReduction = null,
    expiresAt = null,
    effectState
  } = announcement;
  // Proc rows are presentation only; combat effects have already been applied by the caller.
  if (!context.reporting) return;
  // Only explicit mechanic-owned state creates a track; timed buff packets are observed from accepted storage.
  if (type === 'relic' && effectState != null && (context.deathTime == null || at <= context.deathTime))
    context.effectRecorder?.capture(
      at,
      [
        timedEffectState('relic:' + name, [{ stacks: effectState.stacks, expiresAt }], effectState.maximumStacks, {
          name
        })
      ],
      'relic:' + name
    );
  const start = Math.round(at * 1000);
  // Detail distinguishes genuinely sequential procs (e.g. per-blade stack counts)
  // landing at the same instant from the same skill; without it they'd collapse to one row.
  const key = `${type}|${name}|${start}|${sourceSkill}|${detail}`;
  if (context.procKeys.has(key)) return;
  context.procKeys.add(key);
  const reducedBy = Number(cooldownReduction);
  const expiry = Math.round(gw2EffectExpiresAt(at, Number(expiresAt) - at) * 1000);
  context.procSteps.push({
    ri: -1,
    type: `${type}_proc`,
    skill: name,
    sourceSkill,
    detail,
    icon,
    ...(Number.isFinite(reducedBy) && reducedBy > 0 ? { cooldownReduction: reducedBy } : {}),
    ...(Number.isFinite(expiry) && expiry > start ? { expiresAt: expiry } : {}),
    // Copy the numeric state so summaries never need to parse display text or inspect mutable relic state.
    ...(effectState ? { effectState: { ...effectState } } : {}),
    start,
    end: start
  });
}
