/**
 * Stable Guardian state facade. Runtime allocation is owned by Core and the
 * selected specialization module.
 */
import {
  createGuardianCoreState,
  projectGuardianEndState,
  snapshotGuardianState,
} from "./core/state.js";
import { createFirebrandState } from "./specializations/firebrand/state.js";
import { createLuminaryState } from "./specializations/luminary/state.js";
import type { GuardianConfig, GuardianState } from "./types.js";

export {
  createGuardianCoreState,
  GUARDIAN_PUBLIC_END_STATE_KEYS,
  projectGuardianEndState,
  snapshotGuardianState,
} from "./core/state.js";
export { createFirebrandState } from "./specializations/firebrand/state.js";
export { createLuminaryState } from "./specializations/luminary/state.js";

export function createGuardianState(
  config: GuardianConfig = {},
): GuardianState {
  const core = createGuardianCoreState();
  const specialization =
    config.specialization === "Firebrand"
      ? createFirebrandState(config)
      : config.specialization === "Luminary"
        ? createLuminaryState()
        : {};
  return Object.assign(core, specialization) as GuardianState;
}

export function createGuardianResolverState(
  config: GuardianConfig = {},
): GuardianState {
  return createGuardianState(config);
}
