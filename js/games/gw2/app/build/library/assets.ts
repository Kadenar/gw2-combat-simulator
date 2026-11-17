import type { BuildTemplatePreset } from '#gw2/app/build/types.js';
import { fetchJsonAsset } from '#gw2/integrations/assets.js';

interface PresetBundle {
  readonly buildData: unknown;
  readonly rotationData: unknown;
}

/** Keeps the complete rotation payload so loading can apply its saved simulation settings. */
export async function loadPresetBundle(preset: BuildTemplatePreset): Promise<PresetBundle> {
  // The independent assets can download together instead of adding two network round trips to a template load.
  const [buildData, rotationData] = await Promise.all([
    fetchJsonAsset(preset.build),
    preset.rotation ? fetchJsonAsset(preset.rotation, { optional: true }) : undefined
  ]);
  return { buildData, rotationData };
}
