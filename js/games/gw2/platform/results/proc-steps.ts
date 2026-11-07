/** Preserves identified proc occurrences while coalescing repeated announcements of the same occurrence. */
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import type { AnnouncementEmission } from '#gw2/platform/effects/emission.js';
import type { EffectReportObserver } from '#gw2/platform/results/effect-report.js';
import type { Gw2ProcStep } from '#gw2/platform/results/types.js';

/** Optional reporting observes executed announcements through this protocol; resolution never owns proc rows. */
export interface ProcStepObserver {
  record(announcement: AnnouncementEmission['announcement'], deathTime: number | null): void;
  readonly steps: readonly Gw2ProcStep[];
}

/** Project executed announcements into timeline rows without introducing a combat packet or consuming RNG identity. */
export class ProcStepRecorder implements ProcStepObserver {
  readonly steps: Gw2ProcStep[] = [];
  private readonly keys = new Set<string>();

  constructor(private readonly effectRecorder: EffectReportObserver | null = null) {}

  record(announcement: AnnouncementEmission['announcement'], deathTime: number | null): void {
    const {
      type,
      name,
      at,
      occurrenceId,
      sourceSkill = '',
      detail = '',
      icon = '',
      cooldownReduction = null,
      expiresAt = null,
      effectState
    } = announcement;

    // Proc rows are presentation only; combat effects have already been applied by the caller.
    // Only explicit mechanic-owned state creates a track; timed buff packets are observed from accepted storage.
    if (type === 'relic' && effectState != null && (deathTime == null || at <= deathTime))
      this.effectRecorder?.capture(
        at,
        [
          timedEffectState('relic:' + name, [{ stacks: effectState.stacks, expiresAt }], effectState.maximumStacks, {
            name
          })
        ],
        'relic:' + name
      );

    const start = Math.round(at * 1000);
    // Independent combos can have identical display text and timestamps; their IDs preserve each visible proc.
    const key = JSON.stringify([type, name, start, sourceSkill, detail, occurrenceId]);

    if (this.keys.has(key)) return;

    this.keys.add(key);
    const reducedBy = Number(cooldownReduction);
    const expiry = Math.round(gw2EffectExpiresAt(at, Number(expiresAt) - at) * 1000);
    this.steps.push({
      type: `${type}_proc`,
      skill: name,
      sourceSkill,
      detail,
      icon,
      ...(Number.isFinite(reducedBy) && reducedBy > 0 ? { cooldownReduction: reducedBy } : {}),
      ...(Number.isFinite(expiry) && expiry > start ? { expiresAt: expiry } : {}),
      // Copy the numeric state so summaries never need to parse display text or inspect mutable relic state.
      ...(effectState ? { effectState: { ...effectState } } : {}),
      // Announcements are point observations; the timeline derives their insertion position from this instant.
      start
    });
  }
}
