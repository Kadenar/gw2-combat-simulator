// Detects which parts a saved build file carries and applies only the parts the user chooses.

import { getRotationItems } from '#gw2/app/build/io/files.js';
import { manifestRotationMatchesBuild } from '#gw2/app/build/io/rotation-import-dialog.js';
import { replaceBuild, replaceBuildConfiguration, replaceBuildRotation } from '#gw2/app/build/state/persistence.js';

import type { ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';

export const BUILD_FILE_IMPORT_ACCEPT = '.json,application/json';

export interface BuildFileImportPreview {
  readonly fileName: string;
  /** Imported build with any rotation normalized against its own specializations; null for rotation-only files. */
  readonly build: Gw2ApplicationBuild | null;
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
  // Rotation exports are `{ rotation }` or a bare array; any other field marks saved build configuration.
  const hasBuild = !Array.isArray(saved) && Object.keys(saved).some((key) => key !== 'rotation');
  if (!hasBuild && !rotation) throw new Error('No build or rotation found in this file.');

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
    app.build = applyRotation
      ? structuredClone(preview.build!)
      : replaceBuildConfiguration(preview.build, app.build, app.adapter);
    app.changed();
  } else if (applyRotation) {
    // Normalizing through the current build resolves specialization-specific skill names before the first simulation.
    app.build.rotation = replaceBuildRotation(preview.rotation!, app.build, app.adapter).rotation;
    app.changed(false);
  } else {
    throw new Error('Choose the build, the rotation, or both to apply.');
  }
}
