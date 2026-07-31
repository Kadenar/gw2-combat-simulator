/**
 * Stable Mesmer state facade. Runtime allocation is owned by Core and the
 * selected specialization module.
 */
import {
  createMesmerCoreResolverState,
  createMesmerCoreState,
  mesmerResourceDefinition,
  snapshotMesmerState,
} from "./core/state.js";
import { createChronomancerState } from "./specializations/chronomancer/state.js";
import { createMirageState } from "./specializations/mirage/state.js";
import { createTroubadourState } from "./specializations/troubadour/state.js";
import { createVirtuosoState } from "./specializations/virtuoso/state.js";
import type {
  MesmerConfig,
  MesmerProfessionState,
  MesmerResolverState,
} from "./types.js";

export {
  createMesmerCoreResolverState,
  createMesmerCoreState,
  mesmerResourceDefinition,
  snapshotMesmerState,
};
export { createChronomancerState };
export { createMirageState };
export { createTroubadourState };
export { createVirtuosoState };

const SPECIALIZATION_STATE_FACTORIES = Object.freeze({
  Chronomancer: createChronomancerState,
  Mirage: createMirageState,
  Virtuoso: createVirtuosoState,
  Troubadour: createTroubadourState,
});

export function createMesmerState(
  config: Partial<MesmerConfig> = {},
): MesmerProfessionState {
  const specialization = String(
    config.specialization || "Core",
  ) as keyof typeof SPECIALIZATION_STATE_FACTORIES;
  const createSpecializationState =
    SPECIALIZATION_STATE_FACTORIES[specialization];
  return Object.assign(
    createMesmerCoreState(config),
    createSpecializationState?.(config) || {},
  ) as MesmerProfessionState;
}

export function createMesmerResolverState(): MesmerResolverState {
  return createMesmerCoreResolverState();
}
