import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';
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
import type { GuardianState } from '#gw2/professions/guardian/types.js';

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
  // Snapshots can be captured before a flip's expiry task runs; never expose an expired flip to the palette.
  snapshot.availableFlips = Object.fromEntries(
    Object.entries(snapshot.availableFlips || {}).filter(([, window]) => skillFlipVisible(window, at))
  );
  snapshot.symbolicAvengerExpirations = activeSymbolicAvengerExpirations(snapshot, at);
  return snapshot;
}

/** Public projection keys are composed from manifests owned by each Guardian vertical slice. */
export const GUARDIAN_PUBLIC_END_STATE_KEYS = GUARDIAN_PUBLIC_STATE_PROJECTION.keys;

/** Projects only the observed state and its active public windows at the planning boundary. */
export function projectGuardianPlanningState({
  profession,
  time
}: Gw2PlanningStateInput<GuardianRuntimeState>): Partial<GuardianState> {
  return projectPublicProfessionState(
    snapshotGuardianState(profession, time),
    GUARDIAN_PUBLIC_END_STATE_KEYS,
    GUARDIAN_PUBLIC_STATE_PROJECTION.defaults
  );
}
