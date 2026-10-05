import {
  assembleNativeApplicationCatalog,
  assembleNativeRuntimeCatalog,
  getNativeCatalogAssembly
} from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import type { CatalogLookup } from '#gw2/platform/skills/types.js';
import { MESMER_NATIVE_CATALOG_OPTIONS } from '#gw2/professions/mesmer/data/module-data.js';
import { mesmerCoreModule } from '#gw2/professions/mesmer/core/module.js';
import { chronomancerModule } from '#gw2/professions/mesmer/specializations/chronomancer/module.js';
import { mirageModule } from '#gw2/professions/mesmer/specializations/mirage/module.js';
import { troubadourModule } from '#gw2/professions/mesmer/specializations/troubadour/module.js';
import { virtuosoModule } from '#gw2/professions/mesmer/specializations/virtuoso/module.js';

// Kept apart from profession.ts because build/ reads the catalog while profession.ts imports build/.
export const mesmerNativeModules = Object.freeze([
  mesmerCoreModule,
  chronomancerModule,
  mirageModule,
  virtuosoModule,
  troubadourModule
] as const);

export const mesmerCatalog = assembleNativeApplicationCatalog(mesmerNativeModules, MESMER_NATIVE_CATALOG_OPTIONS);

// Keyed by the effective module selection, so unmatched build input shares Core's entry instead of adding keys.
const buildRotationLookups = new Map<string, CatalogLookup>();

/**
 * Returns the Core plus selected-elite name lookup used when loading saved Mesmer rotations.
 *
 * Build loading includes an elite only for an exact module ID and otherwise uses Core alone; unlike runtime
 * selection, it never rejects or trims input. Each selection is assembled once and only its completed name map is
 * retained, because normalization reads names and nothing else.
 */
export function getMesmerBuildRotationLookup(requestedSpecialization: unknown): CatalogLookup {
  const elite = mesmerNativeModules.find((module) => module.id !== 'Core' && module.id === requestedSpecialization);
  const selectedId = elite?.id ?? 'Core';
  const cached = buildRotationLookups.get(selectedId);
  if (cached) return cached;

  const { fragments } = getNativeCatalogAssembly(mesmerNativeModules, MESMER_NATIVE_CATALOG_OPTIONS);
  const catalog = assembleNativeRuntimeCatalog(
    mesmerNativeModules
      .filter((module) => module.id === 'Core' || module.id === selectedId)
      .map((module) => fragments.get(module.id)!)
  );

  const lookup: CatalogLookup = Object.freeze({ skillsByName: catalog.skillsByName });
  buildRotationLookups.set(selectedId, lookup);
  return lookup;
}
