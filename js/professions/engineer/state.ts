/**
 * Stable Engineer state facade. Runtime ownership lives in Core and the active
 * specialization state module.
 */
import { createEngineerCoreState } from "./core/state.js";
import { createAmalgamState } from "./specializations/amalgam/state.js";
import { createHolosmithState } from "./specializations/holosmith/state.js";
import { createMechanistState } from "./specializations/mechanist/state.js";
import { createScrapperState } from "./specializations/scrapper/state.js";
import type {
  EngineerConfig,
  EngineerState,
} from "./types.js";

export {
  createEngineerCoreState,
  ENGINEER_PUBLIC_END_STATE_KEYS,
  hasEngineerTrait,
  projectEngineerEndState,
  selectedEngineerTraits,
  snapshotEngineerState,
} from "./core/state.js";
export {
  ENGINEER_MECH_BASE_ATTRIBUTES,
  createMechanistState,
  engineerMechAttributes,
  selectedMechCommands,
} from "./specializations/mechanist/state.js";
export { createAmalgamState } from "./specializations/amalgam/state.js";
export { createHolosmithState } from "./specializations/holosmith/state.js";
export { createScrapperState } from "./specializations/scrapper/state.js";

const SPECIALIZATION_STATE_FACTORIES = Object.freeze({
  Scrapper: createScrapperState,
  Holosmith: createHolosmithState,
  Mechanist: createMechanistState,
  Amalgam: createAmalgamState,
});

export function createEngineerState(
  config: EngineerConfig = {},
): EngineerState {
  const specialization = String(
    config.specialization || "Core",
  ) as keyof typeof SPECIALIZATION_STATE_FACTORIES;
  const createSpecializationState =
    SPECIALIZATION_STATE_FACTORIES[specialization];
  return Object.assign(
    createEngineerCoreState(config),
    createSpecializationState?.(config as never) || {},
  ) as EngineerState;
}
