import { skillFlipVisible } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  composePublicStateProjections,
  projectPublicProfessionState,
  snapshotProfessionState
} from '#gw2/platform/engine/profession/state.js';
import {
  activeSymbolicAvengerExpirations,
  GUARDIAN_CORE_PUBLIC_STATE_PROJECTION
} from '#gw2/professions/guardian/core/state.js';
import { DRAGONHUNTER_PUBLIC_STATE_PROJECTION } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import { FIREBRAND_PUBLIC_STATE_PROJECTION } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { LUMINARY_PUBLIC_STATE_PROJECTION } from '#gw2/professions/guardian/specializations/luminary/state.js';
import { WILLBENDER_PUBLIC_STATE_PROJECTION } from '#gw2/professions/guardian/specializations/willbender/state.js';
import type { GuardianPlanningStateProjectionOptions, GuardianState } from '#gw2/professions/guardian/types.js';

// Compose public metadata once; runtime initialization and resolver ownership stay with each slice.
const GUARDIAN_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  GUARDIAN_CORE_PUBLIC_STATE_PROJECTION,
  DRAGONHUNTER_PUBLIC_STATE_PROJECTION,
  WILLBENDER_PUBLIC_STATE_PROJECTION,
  FIREBRAND_PUBLIC_STATE_PROJECTION,
  LUMINARY_PUBLIC_STATE_PROJECTION
]);

/** Detaches canonical combat state and expires public windows at the observation time. */
export function snapshotGuardianState(state: unknown, at: number): GuardianState {
  const snapshot = snapshotProfessionState<GuardianState>(state);
  // Snapshots can be requested before scheduler cleanup; never expose an expired flip to the palette.
  snapshot.availableFlips = Object.fromEntries(
    Object.entries(snapshot.availableFlips || {}).filter(([, window]) => skillFlipVisible(window, at))
  );
  snapshot.symbolicAvengerExpirations = activeSymbolicAvengerExpirations(snapshot, at);
  return snapshot;
}

/** Public projection keys are composed from manifests owned by each Guardian vertical slice. */
export const GUARDIAN_PUBLIC_END_STATE_KEYS = GUARDIAN_PUBLIC_STATE_PROJECTION.keys;

/** Projects scheduler predictions at the planning boundary without borrowing resolved combat effects. */
export function projectGuardianPlanningState({
  schedulerState
}: GuardianPlanningStateProjectionOptions): Partial<GuardianState> {
  return projectPublicProfessionState(
    snapshotGuardianState(schedulerState.profession, schedulerState.time),
    GUARDIAN_PUBLIC_END_STATE_KEYS,
    GUARDIAN_PUBLIC_STATE_PROJECTION.defaults
  );
}
