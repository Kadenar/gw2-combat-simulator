import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { warriorCoreModule } from '#gw2/professions/warrior/core/module.js';
import { berserkerModule } from '#gw2/professions/warrior/specializations/berserker/module.js';
import { spellbreakerModule } from '#gw2/professions/warrior/specializations/spellbreaker/module.js';
import { bladeswornModule } from '#gw2/professions/warrior/specializations/bladesworn/module.js';
import { paragonModule } from '#gw2/professions/warrior/specializations/paragon/module.js';
import { WARRIOR_NATIVE_CATALOG_OPTIONS } from '#gw2/professions/warrior/data/module-data.js';

// Kept apart from profession.ts because build/ reads the catalog while profession.ts imports build/.
export const warriorNativeModules = Object.freeze([
  warriorCoreModule,
  berserkerModule,
  spellbreakerModule,
  bladeswornModule,
  paragonModule
] as const);

export const warriorCatalog = assembleNativeApplicationCatalog(warriorNativeModules, WARRIOR_NATIVE_CATALOG_OPTIONS);
