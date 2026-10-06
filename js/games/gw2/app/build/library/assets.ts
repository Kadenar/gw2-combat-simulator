import { fetchJsonAsset, getRotationItems } from '#gw2/app/import-export/files.js';
import type { BuildTemplatePreset } from '#gw2/app/build/types.js';

interface PresetBundle {
  readonly buildData: unknown;
  readonly rotationItems: unknown[] | undefined;
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
