import {
  createDefaultTargetConditions,
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  toApplicationBuild,
} from "../professions/mesmer/build.js";

// Preserve the existing key so locally saved v2 builds migrate in place.
export const STORAGE_KEY = "gw2-mesmer-simulator-v2";

export { createDefaultTargetConditions };

export function createDefaultBuild() {
  return toApplicationBuild(createMesmerBuildDefaults());
}

export function loadBuild() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return toApplicationBuild(saved || createMesmerBuildDefaults());
  } catch {
    return createDefaultBuild();
  }
}

export function saveBuild(build) {
  const persisted = migrateMesmerBuild(build);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

export function replaceBuild(saved) {
  try {
    return toApplicationBuild(saved);
  } catch {
    return createDefaultBuild();
  }
}
