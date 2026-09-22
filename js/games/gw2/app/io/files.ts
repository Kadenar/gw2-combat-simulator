// File I/O utilities for import/export of builds and rotations.

import { bindDialog, showDialog } from '#app/page/dialog.js';
import type { BuildTemplatePreset } from '#gw2/app/build/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

interface FetchJsonAssetOptions {
  readonly optional?: boolean;
}

interface PresetBundle {
  readonly buildData: unknown;
  readonly rotationItems: unknown[] | undefined;
}

/** One selectable export variant; its filename becomes the default name when chosen. */
export interface JsonExportChoice {
  readonly label: string;
  readonly filename: string;
  readonly payload: unknown;
}

/** Normalize the submitted name once so every JSON export preserves a usable extension and default. */
export function jsonExportFilename(entered: string, fallback: string): string {
  const name = entered.trim() || fallback;
  return /\.json$/i.test(name) ? name : name + '.json';
}

/**
 * Uses the app's modal controls to name an export, downloading only when the form is submitted.
 *
 * Passing an array of choices lets the user pick which payload to export; the first choice is selected by default.
 */
export function downloadJson(filename: string, payload: unknown): void;
export function downloadJson(choices: readonly JsonExportChoice[]): void;
export function downloadJson(filenameOrChoices: string | readonly JsonExportChoice[], payload?: unknown): void {
  const choices =
    typeof filenameOrChoices === 'string' ? [{ label: '', filename: filenameOrChoices, payload }] : filenameOrChoices;
  if (!choices.length) throw new Error('No export choices provided.');
  let selected = choices[0]!;

  const dialog = document.createElement('dialog');
  dialog.className = 'file-export-dialog';
  dialog.setAttribute('aria-labelledby', 'file-export-title');
  dialog.innerHTML = `<form>
    <h2 id="file-export-title">Export file</h2>
    ${
      choices.length > 1
        ? `<fieldset class="file-export-choices">
      <legend>Contents</legend>
      ${choices
        .map(
          (_choice, index) => `<label class="file-export-choice">
        <input type="radio" name="file-export-choice" value="${index}"${index === 0 ? ' checked' : ''}>
        <span></span>
      </label>`
        )
        .join('')}
    </fieldset>`
        : ''
    }
    <label for="file-export-name">File name</label>
    <input id="file-export-name" name="filename" type="text" autocomplete="off" spellcheck="false" autofocus>
    <div class="file-export-actions app-dialog-actions">
      <button type="button" class="btn btn-io" data-dialog-close>Cancel</button>
      <button type="submit" class="btn btn-io">Export</button>
    </div>
  </form>`;
  const input = dialog.querySelector<HTMLInputElement>('#file-export-name')!;
  input.value = selected.filename;
  input.placeholder = selected.filename;
  dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((radio, index) => {
    // Labels are assigned as text so profession-provided names cannot inject markup.
    radio.nextElementSibling!.textContent = choices[index]!.label;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      // Only replace the name while it is still the previous default, preserving a name the user typed.
      const untouched = !input.value.trim() || input.value === selected.filename;
      selected = choices[index]!;
      input.placeholder = selected.filename;
      if (untouched) input.value = selected.filename;
    });
  });
  dialog.querySelector('form')!.addEventListener('submit', (event) => {
    event.preventDefault();
    const exportName = jsonExportFilename(input.value, selected.filename);

    const blob = new Blob([JSON.stringify(selected.payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportName;
    link.click();
    // Some browsers start the download asynchronously and cancel it if the URL is revoked in the same task.
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
export function getBuildExportPayload(build: Gw2CanonicalBuild): Omit<Gw2CanonicalBuild, 'rotation'> {
  const { rotation: _rotation, ...payload } = build;
  return payload;
}

/**
 * Creates an exportable build payload that keeps its rotation.
 *
 * The flat shape stays readable by both importers: build import reads the build fields and the rotation
 * import reads the `rotation` array.
 */
export function getBuildWithRotationExportPayload(build: Gw2CanonicalBuild): Gw2CanonicalBuild {
  return { ...build, rotation: [...build.rotation] };
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
