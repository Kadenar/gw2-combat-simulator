export interface ConditionTickContribution {
  readonly source: string;
  readonly actor: string;
  readonly appliedAtMs: number;
  readonly stacks: number;
  readonly fraction?: number;
  readonly damage: number;
}

// One resolved hit/tick: time (ms, relative to the DPS window), damage, and
// whether it critically struck (null when deterministic runs use expected crits).
export interface SkillHit {
  readonly t: number;
  readonly v: number;
  readonly crit?: boolean | null;
  // Presentation-only pulse state; absent for hits without a matching application.
  readonly empowered?: boolean;
  readonly activationId?: string;
  readonly damageType?: 'strike' | 'condition';
  readonly conditionType?: string;
  readonly contributions?: readonly ConditionTickContribution[];
  // The skill whose hit triggered this proc, when the hit is not itself a direct cast.
  readonly triggeredBy?: string;
}

const CONDITION_WINDOW_MS = 5000;

/** Keeps strike bursts intact while bounding condition groups to fixed fight-time windows. */
export function groupSkillHits(hits: readonly SkillHit[], timeOffsetMs = 0): SkillHit[][] {
  const groups = new Map<string | SkillHit, SkillHit[]>();
  const conditions = new Map<number, SkillHit[]>();
  for (const hit of [...hits].sort((left, right) => left.t - right.t)) {
    if (!(hit.v > 0)) continue;
    if (hit.damageType === 'condition') {
      const window = Math.floor((hit.t + timeOffsetMs) / CONDITION_WINDOW_MS);
      const ticks = conditions.get(window) || [];
      ticks.push(hit);
      conditions.set(window, ticks);
      continue;
    }

    const key = hit.activationId || hit;
    const group = groups.get(key) || [];
    group.push(hit);
    groups.set(key, group);
  }

  // ponytail: a fixed 1.5s gap defines a burst; add a user control only if skills need different grouping windows.
  const bursts: SkillHit[][] = [];
  let burstEnd = -Infinity;
  for (const group of groups.values()) {
    if (group[0]!.t - burstEnd > 1500) bursts.push([...group]);
    else bursts.at(-1)!.push(...group);
    burstEnd = Math.max(burstEnd, group.at(-1)!.t);
  }

  return [...bursts.map((burst) => burst.sort((left, right) => left.t - right.t)), ...conditions.values()];
}

export const hitTime = (timeMs: number): string => `${(timeMs / 1000).toFixed(2)}s`;

// Clip the displayed window to the timeline bounds without moving its fight-time bucket.
export const conditionWindow = (hits: readonly SkillHit[], offsetMs: number, durationMs: number): [number, number] => {
  const start = Math.floor((hits[0]!.t + offsetMs) / CONDITION_WINDOW_MS) * CONDITION_WINDOW_MS - offsetMs;
  return [Math.max(0, start), Math.min(durationMs, start + CONDITION_WINDOW_MS)];
};

export const hitGroupLabel = (hits: readonly SkillHit[], offsetMs: number, durationMs: number): string => {
  if (hits[0]!.damageType === 'condition') {
    const [start, end] = conditionWindow(hits, offsetMs, durationMs);
    const range = start === end ? hitTime(start + offsetMs) : `${hitTime(start + offsetMs)}–${hitTime(end + offsetMs)}`;
    return `${range} · ${hits.length} ${hits.length === 1 ? 'tick' : 'ticks'}`;
  }

  return `${hitTime(hits[0]!.t + offsetMs)} · ${hits.length} ${hits.length === 1 ? 'hit' : 'hits'}`;
};
