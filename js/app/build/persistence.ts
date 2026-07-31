import type {
  Gw2AppAdapter,
  ProfessionApplicationBuild,
} from "../profession/types.js";

/**
 * Validates and returns an application state adapter.
 *
 * @param {unknown} adapter Candidate adapter.
 * @returns {Gw2AppAdapter} Validated adapter.
 * @throws {TypeError} When the adapter lacks a profession or storage key.
 */
function resolveAdapter(adapter: unknown): Gw2AppAdapter {
  if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
    throw new TypeError("Application state requires a profession app adapter.");
  }
  const candidate = adapter as Partial<Gw2AppAdapter>;
  if (
    !candidate.profession ||
    !candidate.storageKey ||
    typeof candidate.toApplicationBuild !== "function"
  ) {
    throw new TypeError("Application state requires a profession app adapter.");
  }
  return candidate as Gw2AppAdapter;
}

/**
 * Creates fresh application build state from a profession's defaults.
 *
 * @param {Gw2AppAdapter} adapter Profession application adapter.
 * @returns {ProfessionApplicationBuild} Default application build.
 * @throws {TypeError} When the adapter is invalid.
 */
export function createDefaultBuild(
  adapter: Gw2AppAdapter,
): ProfessionApplicationBuild {
  const resolved = resolveAdapter(adapter);
  return resolved.toApplicationBuild(resolved.profession.createBuildDefaults());
}

/**
 * Loads a profession build from browser storage.
 *
 * Missing, unreadable, or invalid stored data falls back to a fresh default
 * build.
 *
 * @param {Gw2AppAdapter} adapter Profession application adapter.
 * @returns {ProfessionApplicationBuild} Restored or default application build.
 * @throws {TypeError} When the adapter is invalid.
 */
export function loadBuild(adapter: Gw2AppAdapter): ProfessionApplicationBuild {
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
 * @param {ProfessionApplicationBuild} build Application build to persist.
 * @param {Gw2AppAdapter} adapter Profession application adapter.
 * @returns {void}
 * @throws {TypeError} When the adapter is invalid.
 */
export function saveBuild(
  build: ProfessionApplicationBuild,
  adapter: Gw2AppAdapter,
): void {
  const resolved = resolveAdapter(adapter);
  const persisted = resolved.profession.migrateBuild(build);
  localStorage.setItem(resolved.storageKey, JSON.stringify(persisted));
}

/**
 * Converts imported or saved build data into application state.
 *
 * @param {unknown} saved Build data to convert.
 * @param {Gw2AppAdapter} adapter Profession application adapter.
 * @returns {ProfessionApplicationBuild} Converted application build.
 * @throws {TypeError} When the adapter is invalid.
 */
export function replaceBuild(
  saved: unknown,
  adapter: Gw2AppAdapter,
): ProfessionApplicationBuild {
  const resolved = resolveAdapter(adapter);
  return resolved.toApplicationBuild(saved);
}

/**
 * Replaces build configuration while preserving the current rotation.
 *
 * Rotation data included in `saved` is discarded. If the current build has no
 * rotation array, the replacement receives an empty rotation.
 *
 * @param {unknown} saved Imported build configuration.
 * @param {ProfessionApplicationBuild | null | undefined} currentBuild Current
 * application build.
 * @param {Gw2AppAdapter} adapter Profession application adapter.
 * @returns {ProfessionApplicationBuild} Replacement build with the current
 * rotation.
 * @throws {TypeError} When the adapter is invalid.
 */
export function replaceBuildConfiguration(
  saved: unknown,
  currentBuild: ProfessionApplicationBuild | null | undefined,
  adapter: Gw2AppAdapter,
): ProfessionApplicationBuild {
  const build = replaceBuild(saved, adapter);
  build.rotation = Array.isArray(currentBuild?.rotation)
    ? currentBuild.rotation
    : [];
  return build;
}
