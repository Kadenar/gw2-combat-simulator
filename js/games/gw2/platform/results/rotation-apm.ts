import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { InputTrace } from '#gw2/platform/results/input-trace.js';
import { rankedInputWindows } from '#gw2/platform/results/input-windows.js';
import type { SimulationStep } from '#gw2/platform/results/types.js';
import { activationInputKind } from '#gw2/platform/skills/autoattack-chain-index.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';

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

interface RotationApmPeak {
  readonly startSeconds: number;
  readonly endSeconds: number;
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

/** Project the canonical trace window into APM units; the activity chart uses the same window counts. */
function peakApm(trace: InputTrace, seconds: number): RotationApmPeak | null {
  const peak = rankedInputWindows(trace, seconds)[0];
  return peak ? { startSeconds: peak.start, endSeconds: peak.end, apm: peak.rate * 60 } : null;
}

/** Manual counts come from accepted inputs; executed events supply autoattack and animation occupancy details. */
export function rotationApm(
  executed: {
    steps: readonly SimulationStep[];
    events: readonly Gw2ResolverEvent[];
    inputTrace: InputTrace;
  },
  commands: readonly RotationCommand[],
  catalog: CanonicalCatalog
): RotationApm {
  const { events, steps, inputTrace } = executed;
  // An explicit combat boundary excludes precasts; otherwise input accounting begins at zero.
  const { start, end } = inputTrace;
  const durationSeconds = Math.max(0, end - start);
  // Action events retain exact seconds; step display timestamps are rounded to milliseconds.
  const activations = new Map(
    events
      .filter((event) => event.type === 'action' && event.activationId != null)
      .map((event) => [event.activationId, event])
  );
  const seen = new Set<string>();
  const castIntervals: [number, number][] = [];
  const autoattackIntervals: [number, number][] = [];
  let autoattackCount = 0;
  for (const step of steps) {
    const command = commands[step.ri];

    if (step.invalid || !step.activationId || command?.type !== 'cast') continue;

    const activation = activations.get(step.activationId);
    const skill = step.skillId == null ? undefined : catalog.skillsById.get(step.skillId);

    if (
      !activation ||
      !skill ||
      command.skillId !== skill.id ||
      activation.skillId !== skill.id ||
      activation.at > end ||
      seen.has(step.activationId)
    )
      continue;

    seen.add(step.activationId);
    const autoattack = activationInputKind(catalog, skill) === 'autoattack';
    const castEnd = Number(activation.endsAt);

    // Precasts may still occupy the player inside combat; only their activation is excluded from input counts.
    if (!skill.independentCast && castEnd > start) {
      const interval: [number, number] = [Math.max(start, activation.at), Math.min(end, castEnd)];
      castIntervals.push(interval);

      if (autoattack) autoattackIntervals.push(interval);
    }

    if (activation.at >= start && autoattack) autoattackCount += 1;
  }

  // Movement-only commands never enter the trace. Queued commands count at acceptance, even if their animation is later.
  const actionCount = inputTrace.actions.length;
  const categoryCount = (category: string): number =>
    inputTrace.actions.filter((input) => catalog.skillsById.get(input.skillId)?.inputCategory === category).length;
  return {
    actionCount,
    durationSeconds,
    apm: durationSeconds > 0 ? (actionCount * 60) / durationSeconds : null,
    autoattackCount,
    autoattackTimeSeconds: occupiedSeconds(autoattackIntervals),
    castingTimeSeconds: occupiedSeconds(castIntervals),
    instantActionCount: inputTrace.actions.filter((input) => {
      const activation = activations.get(input.activationId);
      return activation && Number(activation.fullEndsAt) === activation.at;
    }).length,
    weaponSwapCount: categoryCount('weapon-swap'),
    barSwapCount: categoryCount('bar-swap'),
    peak5s: peakApm(inputTrace, 5),
    peak10s: peakApm(inputTrace, 10)
  };
}
