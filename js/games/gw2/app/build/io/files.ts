// File I/O utilities for import/export of builds and rotations.

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
 * Downloads a value as pretty-printed JSON using a temporary object URL.
 */
export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
  const buildData = await fetchJsonAsset(preset.build);
  let rotationItems: unknown[] | undefined;
  if (preset.rotation) {
    const rotationData = await fetchJsonAsset(preset.rotation, {
      optional: true
    });
    const items = getRotationItems(rotationData);
    if (Array.isArray(items)) {
      rotationItems = items;
    }
  }

  return { buildData, rotationItems };
}
