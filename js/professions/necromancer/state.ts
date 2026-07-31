/**
 * Stable Necromancer state facade.
 *
 * Runtime ownership lives in Core and specialization-local state modules. This
 * file retains the legacy flat factory and public exports used by application
 * and characterization code.
 */
import { createNecromancerCoreState } from "./core/state.js";
import { createHarbingerState } from "./specializations/harbinger/state.js";
import { createReaperState } from "./specializations/reaper/state.js";
import { createRitualistState } from "./specializations/ritualist/state.js";
import { createScourgeState } from "./specializations/scourge/state.js";
import type { NecromancerConfig, NecromancerState } from "./types.js";

export {
  actualNecromancerLifeForceCost,
  createNecromancerCoreState,
  hasNecromancerTrait,
  NECROMANCER_BASE_HEALTH,
  NECROMANCER_PUBLIC_END_STATE_KEYS,
  normalizedNecromancerLifeForceCost,
  projectNecromancerEndState,
  selectedNecromancerTraits,
  snapshotNecromancerState,
  syncNecromancerResources,
} from "./core/state.js";
export { createHarbingerState } from "./specializations/harbinger/state.js";
export { createReaperState } from "./specializations/reaper/state.js";
export { createRitualistState } from "./specializations/ritualist/state.js";
export { createScourgeState } from "./specializations/scourge/state.js";

const SPECIALIZATION_STATE_FACTORIES = Object.freeze({
  Reaper: createReaperState,
  Scourge: createScourgeState,
  Harbinger: createHarbingerState,
  Ritualist: createRitualistState,
});

export function createNecromancerState(
  config: NecromancerConfig = {},
): NecromancerState {
  const specialization = String(
    config.specialization || "Core",
  ) as keyof typeof SPECIALIZATION_STATE_FACTORIES;
  const createSpecializationState =
    SPECIALIZATION_STATE_FACTORIES[specialization];
  return Object.assign(
    createNecromancerCoreState(config),
    createSpecializationState?.(config as never) || {},
  ) as NecromancerState;
}

export function createNecromancerResolverState(
  config: NecromancerConfig = {},
): NecromancerState {
  return createNecromancerState(config);
}
