import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
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
