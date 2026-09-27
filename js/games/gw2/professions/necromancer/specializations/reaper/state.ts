import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export type ReaperState = Record<string, never>;

/** Reaper retains its specialization identity while the shared registry owns its proc deadlines. */
function createReaperState(): ReaperState {
  return {};
}

export const reaperState = defineProfessionSpecializationState('Reaper', createReaperState);
