import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import type { SchedulerRunResult } from '#gw2/platform/execution/types.js';
import { isAutoattackSkill } from '#gw2/platform/engine/skills/autoattack-chains.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';

export interface RotationApm {
  readonly actionCount: number;
  readonly durationSeconds: number;
  readonly apm: number | null;
  readonly autoattackCount: number;
  readonly autoattackTimeSeconds: number;
  readonly castingTimeSeconds: number;
  readonly instantActionCount: number;
  readonly weaponSwapCount: number;
  readonly barSwapCount: number;
  readonly peak5s: RotationApmPeak | null;
  readonly peak10s: RotationApmPeak | null;
}

export interface RotationApmPeak {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly actionCount: number;
  readonly apm: number;
}

/** Unions clipped cast intervals so simultaneous actions cannot inflate player animation time. */
function occupiedSeconds(intervals: [number, number][]): number {
  let total = 0;
  let previousEnd = Number.NEGATIVE_INFINITY;
  for (const [start, end] of intervals.sort((a, b) => a[0] - b[0])) {
    total += Math.max(0, end - Math.max(start, previousEnd));
    previousEnd = Math.max(previousEnd, end);
  }

  return total;
}

/** Finds the busiest complete rolling window; timestamps are relative to the rotation's counting boundary. */
function peakApm(starts: readonly number[], duration: number, windowSeconds: number): RotationApmPeak | null {
  if (duration < windowSeconds) return null;
  let peak = { startSeconds: 0, endSeconds: windowSeconds, actionCount: 0, apm: 0 };
  let right = 0;
  for (let left = 0; left < starts.length; left += 1) {
    const atEnd = starts[left]! >= duration - windowSeconds;
    const startSeconds = Math.min(starts[left]!, duration - windowSeconds);
    const endSeconds = atEnd ? duration : startSeconds + windowSeconds;
    // Ordinary windows are half-open; the final window includes an instant input at execution end.
    while (
      right < starts.length &&
      (starts[right]! < endSeconds || (endSeconds === duration && starts[right] === duration))
    )
      right += 1;
    const actionCount = right - left;
    if (actionCount > peak.actionCount)
      peak = { startSeconds, endSeconds, actionCount, apm: (actionCount * 60) / windowSeconds };
    if (atEnd) break;
  }

  return peak;
}

/** Counts executed command activations over the execution window, independently of damage and observation tails. */
export function rotationApm(
  scheduled: Pick<SchedulerRunResult, 'steps' | 'stream'>,
  rotation: readonly unknown[],
  catalog: CanonicalCatalog,
  rotationStartTime = 0
): RotationApm {
  const commands = normalizeRotation(rotation, catalog, { strict: true });
  const { stream, steps } = scheduled;
  const start = stream.resolverHandoff.combatStartTime ?? rotationStartTime;
  const end = stream.rotationEndTime;
  const durationSeconds = Math.max(0, end - start);
  // Action events retain exact seconds; scheduler display timestamps are rounded to milliseconds.
  const activations = new Map(
    stream.events
      .filter((event) => event.type === 'action' && event.activationId != null)
      .map((event) => [event.activationId, event])
  );
  const seen = new Set<string>();
  const starts: { at: number; instant: boolean }[] = [];
  const castIntervals: [number, number][] = [];
  const autoattackIntervals: [number, number][] = [];
  let autoattackCount = 0;
  let weaponSwapCount = 0;
  let barSwapCount = 0;
  for (const step of steps) {
    const command = commands[step.ri];
    if (step.invalid || !step.activationId || command?.type !== 'cast' || command.initialStateDurationMs != null)
      continue;
    const activation = activations.get(step.activationId);
    const skill = step.skillId == null ? undefined : catalog.skillsById.get(step.skillId);
    if (
      !activation ||
      !skill ||
      command.skillId !== skill.id ||
      activation.skillId !== skill.id ||
      activation.at > end ||
      skill.initialStateOnly ||
      seen.has(step.activationId)
    )
      continue;
    seen.add(step.activationId);
    const autoattack = isAutoattackSkill(catalog, skill);
    const castEnd = Number(activation.endsAt);
    // Precasts may still occupy the player inside combat; only their activation is excluded from input counts.
    if (!skill.independentCast && castEnd > start) {
      const interval: [number, number] = [Math.max(start, activation.at), Math.min(end, castEnd)];
      castIntervals.push(interval);
      if (autoattack) autoattackIntervals.push(interval);
    }

    if (activation.at < start) continue;
    if (autoattack) {
      autoattackCount += 1;
      continue;
    }

    // Independent pet commands and concurrent/ammo uses each keep their own scheduler reservation identity.
    starts.push({ at: activation.at - start, instant: Number(activation.fullEndsAt) === activation.at });
    weaponSwapCount += Number(skill.inputCategory === 'weapon-swap');
    barSwapCount += Number(skill.inputCategory === 'bar-swap');
  }

  const activationTimes = starts.map((entry) => entry.at).sort((a, b) => a - b);
  return {
    actionCount: starts.length,
    durationSeconds,
    apm: durationSeconds > 0 ? (starts.length * 60) / durationSeconds : null,
    autoattackCount,
    autoattackTimeSeconds: occupiedSeconds(autoattackIntervals),
    castingTimeSeconds: occupiedSeconds(castIntervals),
    instantActionCount: starts.filter((entry) => entry.instant).length,
    weaponSwapCount,
    barSwapCount,
    peak5s: peakApm(activationTimes, durationSeconds, 5),
    peak10s: peakApm(activationTimes, durationSeconds, 10)
  };
}
