import type { SimulationStep } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface WeaponSetDurationOptions {
  readonly startingWeaponSet?: number;
  readonly timelineEndMs?: number;
  readonly hasSecondWeaponSet?: boolean;
  readonly weaponSwapSkillIds?: ReadonlySet<SkillId>;
}

export interface WeaponSetActiveSegment {
  readonly weaponSet: 1 | 2;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
}

/** Produces one stay per real equipped-set activation so repeated manifest rows retain their own durations. */
export function weaponSetActiveSegments(
  steps: readonly SimulationStep[] = [],
  {
    startingWeaponSet = 1,
    timelineEndMs = 0,
    hasSecondWeaponSet = false,
    weaponSwapSkillIds = new Set<SkillId>()
  }: WeaponSetDurationOptions = {}
): readonly WeaponSetActiveSegment[] {
  const timelineStartMs = Math.min(
    0,
    ...steps.filter((step) => !step.invalid && Number.isFinite(Number(step.start))).map((step) => Number(step.start))
  );
  const timelineEnd = Math.max(timelineStartMs, Number.isFinite(Number(timelineEndMs)) ? Number(timelineEndMs) : 0);
  // Professions without in-combat swapping can still start on either equipped set.
  let activeSet: 1 | 2 = Number(startingWeaponSet) === 2 ? 2 : 1;

  if (!hasSecondWeaponSet) {
    return [
      { weaponSet: activeSet, startMs: timelineStartMs, endMs: timelineEnd, durationMs: timelineEnd - timelineStartMs }
    ];
  }

  const segments: WeaponSetActiveSegment[] = [];
  let segmentStart = timelineStartMs;
  const swaps = steps
    .filter(
      (step) =>
        !step.invalid &&
        step.skillId != null &&
        weaponSwapSkillIds.has(step.skillId) &&
        Number.isFinite(Number(step.end))
    )
    .sort((left, right) => Number(left.end) - Number(right.end) || Number(left.ri) - Number(right.ri));

  for (const swap of swaps) {
    const at = boundedNumber(swap.end, segmentStart, segmentStart, timelineEnd);
    segments.push({ weaponSet: activeSet, startMs: segmentStart, endMs: at, durationMs: at - segmentStart });
    activeSet = activeSet === 1 ? 2 : 1;
    segmentStart = at;
  }

  segments.push({
    weaponSet: activeSet,
    startMs: segmentStart,
    endMs: timelineEnd,
    durationMs: timelineEnd - segmentStart
  });
  return segments;
}

/** Sums every stay for each equipped set while keeping aggregate reporting separate from row presentation. */
export function weaponSetDurationTotals(
  steps: readonly SimulationStep[] = [],
  options: WeaponSetDurationOptions = {}
): ReadonlyMap<number, number> {
  const totals = new Map<number, number>();
  for (const segment of weaponSetActiveSegments(steps, options)) {
    totals.set(segment.weaponSet, (totals.get(segment.weaponSet) || 0) + segment.durationMs);
  }

  return totals;
}
