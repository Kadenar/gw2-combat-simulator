/**
 * @typedef {Object} ApplicationStateAdapter
 * @property {Object} profession Profession definition and build codec.
 * @property {string} storageKey Browser storage key for the profession's build.
 * @property {(build: Object) => Object} toApplicationBuild Converts persisted
 * build data into application state.
 */

/**
 * Validates and returns an application state adapter.
 *
 * @param {*} adapter Candidate adapter.
 * @returns {ApplicationStateAdapter} Validated adapter.
 * @throws {TypeError} When the adapter lacks a profession or storage key.
 */
function resolveAdapter(adapter) {
  if (!adapter?.profession || !adapter.storageKey) {
    throw new TypeError("Application state requires a profession app adapter.");
  }
  return adapter;
}

/**
 * Creates fresh application build state from a profession's defaults.
 *
 * @param {ApplicationStateAdapter} adapter Profession application adapter.
 * @returns {Object} Default application build.
 * @throws {TypeError} When the adapter is invalid.
 */
export function createDefaultBuild(adapter) {
  const resolved = resolveAdapter(adapter);
  return resolved.toApplicationBuild(
    resolved.profession.createBuildDefaults(),
  );
}

/**
 * Loads a profession build from browser storage.
 *
 * Missing, unreadable, or invalid stored data falls back to a fresh default
 * build.
 *
 * @param {ApplicationStateAdapter} adapter Profession application adapter.
 * @returns {Object} Restored or default application build.
 * @throws {TypeError} When the adapter is invalid.
 */
export function loadBuild(adapter) {
  const resolved = resolveAdapter(adapter);
  try {
    const saved = JSON.parse(
      localStorage.getItem(resolved.storageKey) || "null",
    );
    return resolved.toApplicationBuild(
      saved || resolved.profession.createBuildDefaults(),
    );
  } catch {
    return createDefaultBuild(resolved);
  }
}

/**
 * Migrates and persists a build in browser storage.
 *
 * @param {Object} build Application build to persist.
 * @param {ApplicationStateAdapter} adapter Profession application adapter.
 * @returns {void}
 * @throws {TypeError} When the adapter is invalid.
 */
export function saveBuild(build, adapter) {
  const resolved = resolveAdapter(adapter);
  const persisted = resolved.profession.migrateBuild(build);
  localStorage.setItem(resolved.storageKey, JSON.stringify(persisted));
}

/**
 * Converts imported or saved build data into application state.
 *
 * @param {Object} saved Build data to convert.
 * @param {ApplicationStateAdapter} adapter Profession application adapter.
 * @returns {Object} Converted application build.
 * @throws {TypeError} When the adapter is invalid.
 */
export function replaceBuild(saved, adapter) {
  const resolved = resolveAdapter(adapter);
  return resolved.toApplicationBuild(saved);
}

/**
 * Replaces build configuration while preserving the current rotation.
 *
 * Rotation data included in `saved` is discarded. If the current build has no
 * rotation array, the replacement receives an empty rotation.
 *
 * @param {Object} saved Imported build configuration.
 * @param {Object} currentBuild Current application build.
 * @param {ApplicationStateAdapter} adapter Profession application adapter.
 * @returns {Object} Replacement build with the current rotation.
 * @throws {TypeError} When the adapter is invalid.
 */
export function replaceBuildConfiguration(saved, currentBuild, adapter) {
  const build = replaceBuild(saved, adapter);
  build.rotation = Array.isArray(currentBuild?.rotation)
    ? currentBuild.rotation
    : [];
  return build;
}
