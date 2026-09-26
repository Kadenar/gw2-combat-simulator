import { defineProfessionApp } from '#gw2/app/create-adapter.js';
import type { DefineProfessionAppOptions, Gw2AppAdapter } from '#gw2/app/types.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import type { Gw2Build } from '#gw2/platform/builds/types.js';
import type { AnyNativeModule, NativeProfessionContract } from '#gw2/platform/profession-definition/module-types.js';

/** Decorates browser professions once, before the shared adapter captures their catalog and runtime. */
export function definePatchedProfessionApp<
  const TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TBuild extends Gw2Build = Gw2Build
>({
  profession,
  ...options
}: Omit<DefineProfessionAppOptions, 'profession'> & {
  readonly profession: NativeProfessionContract<TModules, TPresentation, TBuild>;
}): Readonly<Gw2AppAdapter> {
  return defineProfessionApp({ ...options, profession: withActivePatchPreview(profession) });
}
