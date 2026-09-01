import type { Gw2AppAdapter } from '#gw2/app/types.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';

/**
 * Validates and returns an application state adapter.
 *
 * @param {unknown} adapter Candidate adapter.
 * @returns {Gw2AppAdapter} Validated adapter.
 * @throws {TypeError} When the adapter lacks a profession or storage key.
 */
function resolveAdapter(adapter: unknown): Gw2AppAdapter {
  if (!adapter || typeof adapter !== 'object' || Array.isArray(adapter)) {
    throw new TypeError('Application state requires a profession app adapter.');
  }

  const candidate = adapter as Partial<Gw2AppAdapter>;
  if (!candidate.profession || !candidate.storageKey || typeof candidate.toApplicationBuild !== 'function') {
    throw new TypeError('Application state requires a profession app adapter.');
  }

  return candidate as Gw2AppAdapter;
}

/**
 * Creates fresh application build state from a profession's defaults.
 *
 * @param {Gw2AppAdapter} adapter Profession application adapter.
 * @returns {Gw2ApplicationBuild} Default application build.
 * @throws {TypeError} When the adapter is invalid.
 */
export function createDefaultBuild(adapter: Gw2AppAdapter): Gw2ApplicationBuild {
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
 * @returns {Gw2ApplicationBuild} Restored or default application build.
 * @throws {TypeError} When the adapter is invalid.
 */
export function loadBuild(adapter: Gw2AppAdapter): Gw2ApplicationBuild {
  const resolved = resolveAdapter(adapter);
  try {
    const saved = JSON.parse(localStorage.getItem(resolved.storageKey) || 'null');
    return resolved.toApplicationBuild(saved || resolved.profession.createBuildDefaults());
  } catch {
    return createDefaultBuild(resolved);
  }
}

/**
 * Migrates and persists a build in browser storage.
 *
 * @param {Gw2ApplicationBuild} build Application build to persist.
 * @param {Gw2AppAdapter} adapter Profession application adapter.
 * @returns {void}
 * @throws {TypeError} When the adapter is invalid.
 */
export function saveBuild(build: Gw2ApplicationBuild, adapter: Gw2AppAdapter): void {
  const resolved = resolveAdapter(adapter);
  const persisted = resolved.profession.migrateBuild(build);
  localStorage.setItem(resolved.storageKey, JSON.stringify(persisted));
}

/**
 * Converts imported or saved build data into application state.
 *
 * @param {unknown} saved Build data to convert.
 * @param {Gw2AppAdapter} adapter Profession application adapter.
 * @returns {Gw2ApplicationBuild} Converted application build.
 * @throws {TypeError} When the adapter is invalid.
 */
export function replaceBuild(saved: unknown, adapter: Gw2AppAdapter): Gw2ApplicationBuild {
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
 * @param {Gw2ApplicationBuild | null | undefined} currentBuild Current
 * application build.
 * @param {Gw2AppAdapter} adapter Profession application adapter.
 * @returns {Gw2ApplicationBuild} Replacement build with the current
 * rotation.
 * @throws {TypeError} When the adapter is invalid.
 */
export function replaceBuildConfiguration(
  saved: unknown,
  currentBuild: Gw2ApplicationBuild | null | undefined,
  adapter: Gw2AppAdapter
): Gw2ApplicationBuild {
  const build = replaceBuild(saved, adapter);
  build.rotation = Array.isArray(currentBuild?.rotation) ? currentBuild.rotation : [];
  return build;
}

/**
 * Replaces a build's rotation through the profession codec.
 *
 * Rotations can contain display names that are ambiguous across specializations.
 * Normalizing the combined build lets the profession resolve those names with
 * the selected specialization before the first simulation.
 *
 * @param {readonly unknown[]} rotation Rotation entries to install.
 * @param {Gw2ApplicationBuild} currentBuild Build supplying specialization context.
 * @param {Gw2AppAdapter} adapter Profession application adapter.
 * @returns {Gw2ApplicationBuild} Normalized build and rotation.
 */
export function replaceBuildRotation(
  rotation: readonly unknown[],
  currentBuild: Gw2ApplicationBuild,
  adapter: Gw2AppAdapter
): Gw2ApplicationBuild {
  return replaceBuild(
    {
      ...currentBuild,
      rotation: Array.isArray(rotation) ? rotation : []
    },
    adapter
  );
}
