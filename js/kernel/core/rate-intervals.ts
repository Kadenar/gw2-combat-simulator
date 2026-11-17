/** Project completion from remaining work without changing progress already earned under earlier rates. */

/** A time window with a constant rate for integrating progress over elapsed time. */
export interface RateInterval {
  readonly start: number;
  readonly end: number;
  readonly rate: number;
}

/** Remaining work anchored to a timestamp; rates express work completed per unit of time. */
export interface WorkProgress {
  workAnchorAt: number;
  work: number;
}

/**
 * Return the unrounded completion time without mutating progress or intervals.
 * Callers supply chronological, contiguous intervals starting at workAnchorAt, with non-negative finite rates
 * and enough coverage to finish the remaining work. Finite zero-rate intervals pause progress. A final interval
 * with an infinite end must have a positive rate.
 */
export function projectWorkCompletion(progress: Readonly<WorkProgress>, intervals: Iterable<RateInterval>): number {
  let work = Math.max(0, progress.work);

  if (!work) return progress.workAnchorAt;

  for (const interval of intervals) {
    const elapsed = work / interval.rate;

    if (elapsed <= interval.end - interval.start) return interval.start + elapsed;

    work -= (interval.end - interval.start) * interval.rate;
  }

  throw new Error('Rate intervals must cover the remaining work.');
}
