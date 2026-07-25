import { createMesmerState } from "../state.js";
import {
  createSchedulerState as createPlatformSchedulerState,
} from "../../../platform/engine/scheduler-state.js";

const MESMER_STATE_CONTRACT = Object.freeze({
  createProfessionState: createMesmerState,
});

export function createSchedulerState({
  infiniteForge = false,
  startingTime = 0,
} = {}) {
  const shared = createPlatformSchedulerState({
    profession: MESMER_STATE_CONTRACT,
    config: { infiniteForge },
    startingTime,
  });
  return shared;
}
