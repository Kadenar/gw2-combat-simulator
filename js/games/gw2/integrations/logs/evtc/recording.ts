import type { ParsedEvtc, ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';

// EI d7f186c CombatItem.HasTime/SrcIsAgent/DstIsAgent: metadata payloads are not timestamps.
const TIMED_STATE_CHANGES = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 34, 35, 37, 38, 43, 44,
  45, 47, 51, 53, 55, 56, 57, 58, 59, 60, 61, 62, 63, 65, 67, 68, 69, 70, 71, 72, 73, 75, 76, 77, 78, 79, 80, 81, 82,
  83, 84
]);

export function hasEvtcTime(event: ParsedEvtcEvent): boolean {
  return TIMED_STATE_CHANGES.has(event.stateChange);
}

/** EI EvtcParser uses the first and last timed records, independently of player or encounter selection. */
export function evtcRecordingWindow(log: ParsedEvtc): { start: number; end: number } {
  let start: number | undefined;
  let end = 0;
  for (const event of log.events) {
    if (!hasEvtcTime(event)) continue;
    start ??= event.time;
    end = event.time;
  }

  return { start: start ?? 0, end };
}

/** EI ArcDPSBuilds.AnimationAsStateChanges selects the encoding even when only a stop survives. */
export function usesModernAnimations(log: ParsedEvtc): boolean {
  return Number(log.header.arcdpsBuild) >= 20260430;
}
