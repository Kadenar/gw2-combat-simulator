// Detects which parts a saved build file carries and applies only the parts the user chooses.

import { getRotationItems } from '#gw2/app/io/files.js';
import { manifestRotationMatchesBuild } from '#gw2/app/io/rotation-import-dialog.js';
import { replaceBuild, replaceBuildRotation } from '#gw2/app/build/state/persistence.js';

import type { ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

export const BUILD_FILE_IMPORT_ACCEPT = '.json,application/json';

// The codec fills every missing field with defaults, so an unrelated JSON object would otherwise import as a
// default build. Older saves can omit `profession`, so any core build field marks a build.
const BUILD_FIELDS = ['profession', 'specializations', 'selectedSkills', 'weapons', 'gear'];

export interface BuildFileImportPreview {
  readonly fileName: string;
  /** Imported build with any rotation normalized against its own specializations; null for rotation-only files. */
  readonly build: Gw2CanonicalBuild | null;
  /** Rotation items as saved; null when the file has no non-empty rotation. */
  readonly rotation: readonly unknown[] | null;
  readonly warnings: readonly string[];
}

export interface BuildFileImportSelection {
  readonly build: boolean;
  readonly rotation: boolean;
}

/**
 * Reads a parsed JSON file as a build, a rotation, or both, without changing app state.
 *
 * @throws {Error} When the file has neither part or the build belongs to another profession.
 */
export function previewBuildFileImport(
  saved: unknown,
  fileName: string,
  app: ProfessionAppState
): BuildFileImportPreview {
  if (!saved || typeof saved !== 'object') throw new Error('File is not a build or rotation JSON.');
  const items = getRotationItems(saved);
  const rotation = items?.length ? items : null;
  // Rotation exports are `{ rotation }` or a bare array; only core build fields mark saved build configuration.
  const hasBuild = !Array.isArray(saved) && BUILD_FIELDS.some((key) => Object.hasOwn(saved, key));
  if (!hasBuild && !rotation) {
    throw new Error('No build or rotation found in this file. Import combat logs with Load rotation.');
  }

  const build = hasBuild ? replaceBuild(saved, app.adapter) : null;
  const warnings: string[] = [];
  if (rotation) {
    const normalized = (build ?? replaceBuildRotation(rotation, app.build, app.adapter)).rotation.length;
    if (normalized < rotation.length) {
      const skipped = rotation.length - normalized;
      warnings.push(
        `Rotation: ${skipped} of ${rotation.length} action${rotation.length === 1 ? '' : 's'} could not be read and will be skipped.`
      );
    }

    if (build && !manifestRotationMatchesBuild(build, app.build)) {
      warnings.push(
        'Skills: This rotation was saved with a different heal, utility, or elite loadout than the current build. Apply the build as well to keep them in sync.'
      );
    }
  }

  return { fileName, build, rotation, warnings };
}

/**
 * Applies the selected parts of a preview.
 *
 * @throws {Error} When the selection names no part the preview contains.
 */
export function applyBuildFileImport(
  app: ProfessionAppState,
  preview: BuildFileImportPreview,
  selection: BuildFileImportSelection
): void {
  const applyBuild = selection.build && preview.build !== null;
  const applyRotation = selection.rotation && preview.rotation !== null;
  if (applyBuild) {
    // The preview already converted the build through the codec; copy it instead of converting it again.
    const build = structuredClone(preview.build!);
    if (!applyRotation) build.rotation = app.build.rotation;
    app.build = build;
    // The imported build is no longer the highlighted template; Reset still returns to the tab's loaded baseline.
    app.currentTemplate = null;
    app.changed();
  } else if (applyRotation) {
    // Normalizing through the current build resolves specialization-specific skill names before the first simulation.
    app.build.rotation = replaceBuildRotation(preview.rotation!, app.build, app.adapter).rotation;
    app.changed(false);
  } else {
    throw new Error('Choose the build, the rotation, or both to apply.');
  }
}
