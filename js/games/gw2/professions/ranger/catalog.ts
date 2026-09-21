import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { rangerCoreModule } from '#gw2/professions/ranger/core/module.js';
import { druidModule } from '#gw2/professions/ranger/specializations/druid/module.js';
import { galeshotModule } from '#gw2/professions/ranger/specializations/galeshot/module.js';
import { soulbeastModule } from '#gw2/professions/ranger/specializations/soulbeast/module.js';
import { untamedModule } from '#gw2/professions/ranger/specializations/untamed/module.js';

// Kept apart from profession.ts because build/ reads the catalog while profession.ts imports build/.
export const rangerNativeModules = Object.freeze([
  rangerCoreModule,
  druidModule,
  soulbeastModule,
  untamedModule,
  galeshotModule
] as const);

export const rangerCatalog = assembleNativeApplicationCatalog(rangerNativeModules);
