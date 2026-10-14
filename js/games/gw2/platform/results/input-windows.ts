import type { InputTrace } from '#gw2/platform/results/input-trace.js';

export interface InputWindow {
  readonly start: number;
  readonly end: number;
  readonly count: number;
  readonly rate: number;
}

/** Shared rolling counts keep APM peaks and activity sections on the same accepted-input boundaries. */
export function rankedInputWindows(trace: InputTrace, windowSeconds: number): InputWindow[] {
  const duration = Math.max(0, trace.end - trace.start);
  if (duration < windowSeconds) return [];
  const times = trace.actions.map((input) => input.at - trace.start).sort((a, b) => a - b);
  const starts = [...new Set([0, ...times.map((at) => Math.min(at, duration - windowSeconds))])].sort((a, b) => a - b);
  const windows: InputWindow[] = [];
  let left = 0,
    right = 0;
  for (const start of starts) {
    const end = start === duration - windowSeconds ? duration : start + windowSeconds;
    // Only the last window includes the exact combat endpoint, matching the trace's accepted-action scope.
    while (right < times.length && (times[right] < end || (end === duration && times[right] === end))) right++;
    while (left < right && times[left] < start) left++;
    const count = right - left;
    windows.push({ start, end, count, rate: count / windowSeconds });
  }

  return windows.sort((a, b) => b.count - a.count || a.start - b.start);
}
