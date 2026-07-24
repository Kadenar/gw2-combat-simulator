import { createMesmerState } from "../state.js";
import {
  createSchedulerState as createPlatformSchedulerState,
} from "../../../platform/engine/scheduler-state.js";

const MESMER_STATE_CONTRACT = Object.freeze({
  createProfessionState: createMesmerState,
});

// Compatibility state for the original Mesmer scheduler. Mesmer fields live
// under profession; the proxy keeps old focused controllers working while they
// migrate to explicit context access.
export function createSchedulerState({
  infiniteForge = false,
  startingTime = 0,
} = {}) {
  const shared = createPlatformSchedulerState({
    profession: MESMER_STATE_CONTRACT,
    config: { infiniteForge },
    startingTime,
  });
  Object.assign(shared, {
    hasExplicitCombatStart: false,
    combatStartTime: 0,
  });
  return new Proxy(shared, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) {
        return Reflect.get(target, property, receiver);
      }
      return Reflect.get(target.profession, property);
    },
    set(target, property, value, receiver) {
      if (Reflect.has(target.profession, property) && !Reflect.has(target, property)) {
        return Reflect.set(target.profession, property, value);
      }
      return Reflect.set(target, property, value, receiver);
    },
  });
}
