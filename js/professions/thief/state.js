/**
 * Stable flat Thief state facade for application and compatibility consumers.
 * Active simulation state is composed from Core plus one specialization.
 */
import { createThiefCoreState } from "./core/state.js";
import { thiefCatalog } from "./catalog.js";
import { createAntiquaryState } from "./specializations/antiquary/state.js";
import { createDaredevilState } from "./specializations/daredevil/state.js";
import { createDeadeyeState } from "./specializations/deadeye/state.js";
import { createSpecterState } from "./specializations/specter/state.js";

export {
  createThiefCoreState,
  hasThiefTrait,
  projectThiefEndState,
  selectedThiefTraits,
  snapshotThiefState,
  THIEF_BASE_HEALTH,
  THIEF_PUBLIC_END_STATE_KEYS,
  thiefBaseMaximumHealth,
} from "./core/state.js";
export { createAntiquaryState } from "./specializations/antiquary/state.js";
export { createDaredevilState } from "./specializations/daredevil/state.js";
export { createDeadeyeState } from "./specializations/deadeye/state.js";
export { createSpecterState } from "./specializations/specter/state.js";

const SPECIALIZATION_STATE_FACTORIES = Object.freeze({
  Daredevil: createDaredevilState,
  Deadeye: createDeadeyeState,
  Specter: createSpecterState,
  Antiquary: createAntiquaryState,
});

export function createThiefState(config = {}) {
  const specialization = String(config.specialization || "Core");
  const createSpecializationState =
    SPECIALIZATION_STATE_FACTORIES[specialization];
  return {
    ...createThiefCoreState(config),
    ...(createSpecializationState?.(config) || {}),
  };
}

export function thiefSkillId(name) {
  return thiefCatalog.skillsByName.get(name)?.id ?? null;
}
