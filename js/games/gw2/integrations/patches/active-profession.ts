import type { Gw2Build } from '#gw2/platform/builds/types.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import type { NativePatchAuthoringContract } from '#gw2/integrations/patches/authoring/module-types.js';
import type { AnyNativeModule, NativeProfessionContract } from '#gw2/platform/profession-definition/module-types.js';

/** Binds the repository's optional active preview only at application and tooling composition boundaries. */
export function withActivePatchPreview<
  const TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TSimulation extends object = object,
  TBuild extends Gw2Build = Gw2Build
>(
  profession: NativeProfessionContract<TModules, TPresentation, TSimulation, TBuild>
): NativePatchAuthoringContract<TModules, TPresentation, TSimulation, TBuild> {
  return withPatchPreview(profession, activePatchPreview);
}
