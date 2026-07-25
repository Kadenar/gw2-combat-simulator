import {
  createGw2ResolverRuntimeState,
} from "../../../platform/gw2/resolver/runtime-state.js";

export function createRuntimeState(options = {}) {
  return createGw2ResolverRuntimeState({
    ...options,
    professionState: options.professionState || {
      ineptitudeReadyAt: 0,
      sharperImagesProgress: 0,
      bloodsongProgress: 0,
    },
    eventFilterState: options.eventFilterState || {
      cloneDeaths: options.cloneDeaths || new Map(),
    },
  });
}
