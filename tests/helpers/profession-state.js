import { flattenProfessionState } from '#gw2/platform/profession-definition/state.js';

/** Capture all active runtime fields for test observations without retaining references to live state. */
export function snapshotProfessionState(professionState) {
  return structuredClone(flattenProfessionState(professionState));
}
