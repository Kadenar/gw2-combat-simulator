import type { BuildContextModule } from '#gw2/build-context/types.js';
import { loadBuildContext } from '#gw2/build-context/load.js';
import { RELIC_NAMES } from '#gw2/platform/equipment/relics/catalog.js';
import { createProfessionWeaponData } from '#gw2/platform/equipment/weapons/data.js';
import type { Gw2WeaponDataEntry } from '#gw2/platform/equipment/weapons/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

/** Search metadata is independent of browser adapters and individual candidate contexts. */
export interface OptimizerContext extends BuildContextModule {
  readonly id: string;
  readonly weaponData: Readonly<Record<string, Gw2WeaponDataEntry>>;
  readonly relicNames: readonly string[];
  eliteSpecialization(build: Gw2CanonicalBuild): string;
}

export async function loadOptimizerContext(contentId: string): Promise<OptimizerContext | null> {
  const module = await loadBuildContext(contentId);

  if (!module) return null;

  const eliteNames = new Set(
    module.profession.catalog.specializations.filter((spec) => spec.elite).map((spec) => spec.name)
  );
  return {
    ...module,
    id: module.profession.id,
    weaponData: createProfessionWeaponData(module.profession.catalog),
    relicNames: RELIC_NAMES,
    eliteSpecialization: (build) => build.specializations.find((spec) => eliteNames.has(spec.name))?.name || 'Core'
  };
}
