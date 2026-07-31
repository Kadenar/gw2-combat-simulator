/**
 * Stable Revenant state facade.
 *
 * Runtime ownership lives in Core and specialization-local state modules. This
 * file retains the legacy flat factory and public exports used by application
 * and characterization code.
 */
import { createRevenantCoreState } from "./core/state.js";
import { createConduitState } from "./specializations/conduit/state.js";
import { createHeraldState } from "./specializations/herald/state.js";
import { createRenegadeState } from "./specializations/renegade/state.js";
import { createVindicatorState } from "./specializations/vindicator/state.js";
import type { RevenantConfig, RevenantState } from "./types.js";

export {
  createRevenantCoreState,
  hasRevenantTrait,
  projectRevenantEndState,
  REVENANT_PUBLIC_END_STATE_KEYS,
  revenantConduitFormIsActive,
  selectedRevenantTraits,
  snapshotRevenantState,
} from "./core/state.js";
export { createConduitState } from "./specializations/conduit/state.js";
export { createHeraldState } from "./specializations/herald/state.js";
export { createRenegadeState } from "./specializations/renegade/state.js";
export { createVindicatorState } from "./specializations/vindicator/state.js";

const SPECIALIZATION_STATE_FACTORIES = Object.freeze({
  Herald: createHeraldState,
  Renegade: createRenegadeState,
  Vindicator: createVindicatorState,
  Conduit: createConduitState,
});

export function createRevenantState(
  config: RevenantConfig = {},
): RevenantState {
  const specialization = String(
    config.specialization || "Core",
  ) as keyof typeof SPECIALIZATION_STATE_FACTORIES;
  const createSpecializationState =
    SPECIALIZATION_STATE_FACTORIES[specialization];
  return Object.assign(
    createRevenantCoreState(config),
    createSpecializationState?.(config as never) || {},
  ) as RevenantState;
}

export function createRevenantResolverState(
  config: RevenantConfig = {},
): RevenantState {
  return createRevenantState(config);
}
