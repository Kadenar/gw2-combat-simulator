import { activeProfessionAppAdapter } from "./composition.js";

export const STORAGE_KEY = activeProfessionAppAdapter.storageKey;
export const createDefaultTargetConditions =
  activeProfessionAppAdapter.createDefaultTargetConditions;

function resolveAdapter(adapter) {
  if (!adapter?.profession || !adapter.storageKey) {
    throw new TypeError("Application state requires a profession app adapter.");
  }
  return adapter;
}

export function createDefaultBuild(adapter = activeProfessionAppAdapter) {
  const resolved = resolveAdapter(adapter);
  return resolved.toApplicationBuild(
    resolved.profession.createBuildDefaults(),
  );
}

export function loadBuild(adapter = activeProfessionAppAdapter) {
  const resolved = resolveAdapter(adapter);
  try {
    const saved = JSON.parse(localStorage.getItem(resolved.storageKey) || "null");
    return resolved.toApplicationBuild(
      saved || resolved.profession.createBuildDefaults(),
    );
  } catch {
    return createDefaultBuild(resolved);
  }
}

export function saveBuild(build, adapter = activeProfessionAppAdapter) {
  const resolved = resolveAdapter(adapter);
  const persisted = resolved.profession.migrateBuild(build);
  localStorage.setItem(resolved.storageKey, JSON.stringify(persisted));
}

export function replaceBuild(saved, adapter = activeProfessionAppAdapter) {
  const resolved = resolveAdapter(adapter);
  try {
    return resolved.toApplicationBuild(saved);
  } catch {
    return createDefaultBuild(resolved);
  }
}

export function replaceBuildConfiguration(
  saved,
  currentBuild,
  adapter = activeProfessionAppAdapter,
) {
  const build = replaceBuild(saved, adapter);
  build.rotation = Array.isArray(currentBuild?.rotation)
    ? currentBuild.rotation
    : [];
  return build;
}
