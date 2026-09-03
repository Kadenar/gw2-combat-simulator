import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import type { NativeProfessionContract as PatchProfessionContract } from '#gw2/integrations/patches/authoring/module-types.js';
import type { AnyNativeModule, NativeProfessionContract } from '#gw2/platform/profession-definition/module-types.js';

/** Binds the repository's optional active preview only at application and tooling composition boundaries. */
export function withActivePatchPreview<
  const TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TSimulation extends object = object
>(
  profession: NativeProfessionContract<TModules, TPresentation, TSimulation>
): PatchProfessionContract<TModules, TPresentation, TSimulation> {
  return withPatchPreview(profession, activePatchPreview);
}
