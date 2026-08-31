import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { snapshotThiefState } from '#gw2/content/professions/thief/core/state.js';
import type { ThiefScheduledTask, ThiefSchedulerContext } from '#gw2/content/professions/thief/types.js';
import { deadeyeState } from '#gw2/content/professions/thief/specializations/deadeye/state.js';
import { resolveDeadeyeMaliceHit } from '#gw2/content/professions/thief/specializations/deadeye/mechanics/malice.js';

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
  emitStateSnapshot(context, 'thief', task.at, 'deadeyes-mark-expired', snapshotThiefState(context.state.profession));
}

export const deadeyeTaskHandlers = Object.freeze({
  'thief.deadeye-mark-expire': expireDeadeyesMark,
  'thief.deadeye-malice-hit': resolveDeadeyeMaliceHit
});
