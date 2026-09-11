// File I/O utilities for import/export of builds and rotations.

import { bindDialog, showDialog } from '#app/dialog.js';
import type { BuildTemplatePreset } from '#gw2/app/build/types.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';

interface FetchJsonAssetOptions {
  readonly optional?: boolean;
}

interface PresetBundle {
  readonly buildData: unknown;
  readonly rotationItems: unknown[] | undefined;
}

/**
 * Uses the app's modal controls to name an export, downloading only when the form is submitted.
 */
export function downloadJson(filename: string, payload: unknown): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'file-export-dialog';
  dialog.setAttribute('aria-labelledby', 'file-export-title');
  dialog.innerHTML = `<form>
    <h2 id="file-export-title">Export file</h2>
    <label for="file-export-name">File name</label>
    <input id="file-export-name" name="filename" type="text" autocomplete="off" spellcheck="false" autofocus>
    <div class="file-export-actions app-dialog-actions">
      <button type="button" class="btn btn-io" data-dialog-close>Cancel</button>
      <button type="submit" class="btn btn-io">Export</button>
    </div>
  </form>`;
  const input = dialog.querySelector('input')!;
  input.value = filename;
  input.placeholder = filename;
  dialog.querySelector('form')!.addEventListener('submit', (event) => {
    event.preventDefault();
    let exportName = input.value.trim() || filename;
    if (!/\.json$/i.test(exportName)) exportName += '.json';

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportName;
    link.click();
    URL.revokeObjectURL(url);
    dialog.close();
  });
  bindDialog(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  input.addEventListener('focus', () => input.select(), { once: true });
  showDialog(dialog);
}

/**
 * Reads a browser `File` as text and parses it as JSON.
 *
 * Parsed JSON value.
 * @throws {Error} Rejects when the file cannot be read or contains invalid JSON.
 */
export function readJsonFile(file: File): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== 'string') {
          throw new Error('File contents are not text.');
        }

        resolve(JSON.parse(reader.result));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reject(new Error(`Invalid JSON: ${message}`));
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Fetches and parses a JSON asset, bypassing the browser cache.
 *
 * Optional requests return `null` instead of throwing for a non-success status.
 *
 * Parsed JSON, or `null` for a missing
 * optional asset.
 * @throws {Error} When a required asset cannot be loaded or the response is not
 * valid JSON.
 */
export async function fetchJsonAsset(
  path: string,
  { optional = false }: FetchJsonAssetOptions = {}
): Promise<unknown | null> {
  const response = await fetch(`${path}?t=${Date.now()}`);
  if (!response.ok) {
    if (optional) return null;
    throw new Error(`Could not load ${path}`);
  }

  return response.json();
}

/**
 * Extracts rotation items from either a bare array or a wrapped rotation payload.
 *
 * Rotation items when present.
 */
export function getRotationItems(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return undefined;
  const rotation = (payload as { rotation?: unknown }).rotation;
  return Array.isArray(rotation) ? rotation : undefined;
}

/**
 * Creates an exportable build payload without its rotation.
 *
 * Shallow copy of the
 * build without the `rotation` property.
 */
export function getBuildExportPayload(build: Gw2ApplicationBuild): Omit<Gw2ApplicationBuild, 'rotation'> {
  const { rotation: _rotation, ...payload } = build;
  return payload;
}

/**
 * Loads a preset's required build and optional rotation assets.
 *
 * A missing optional rotation or a rotation payload without an array is ignored.
 * Other loading and parsing failures are propagated.
 *
 * {Promise<{
 *   buildData: unknown,
 *   rotationItems: unknown[] | undefined,
 * }>} Loaded build data and any valid rotation items.
 */
export async function loadPresetBundle(preset: BuildTemplatePreset): Promise<PresetBundle> {
  // The independent assets can download together instead of adding two network round trips to a template load.
  const [buildData, rotationData] = await Promise.all([
    fetchJsonAsset(preset.build),
    preset.rotation ? fetchJsonAsset(preset.rotation, { optional: true }) : undefined
  ]);
  return { buildData, rotationItems: getRotationItems(rotationData) };
}
