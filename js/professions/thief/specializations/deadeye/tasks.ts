import { emitThiefState } from '../../core/shared.js';
import type { ThiefScheduledTask, ThiefSchedulerContext } from '../../types.js';
import { deadeyeState } from './state.js';
import { resolveDeadeyeMaliceHit } from './mechanics.js';

export function expireDeadeyesMark(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<{ readonly generation?: number }>
): void {
  const state = deadeyeState.from(context);
  // A re-mark increments markGeneration and schedules a new expiry; stale tasks from the previous mark are silently discarded
  if (Number(task.payload.generation || 0) !== state.markGeneration || task.at < state.markExpiresAt) {
    return;
  }
  state.markedTargetId = null;
  state.markExpiresAt = 0;
  // Malice resets when the mark expires; a fresh Deadeye's Mark starts at 0 (or initialDeadeyeMalice if Malicious Intent is equipped)
  state.malice = 0;
  state.maleficentSevenTriggered = false;
  emitThiefState(context, task.at, 'deadeyes-mark-expired');
}

export const deadeyeTaskHandlers = Object.freeze({
  'thief.deadeye-mark-expire': expireDeadeyesMark,
  'thief.deadeye-malice-hit': resolveDeadeyeMaliceHit
});
