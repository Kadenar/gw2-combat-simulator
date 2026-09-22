import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { engineerCoreModule } from '#gw2/professions/engineer/core/module.js';
import { amalgamModule } from '#gw2/professions/engineer/specializations/amalgam/module.js';
import { holosmithModule } from '#gw2/professions/engineer/specializations/holosmith/module.js';
import { mechanistModule } from '#gw2/professions/engineer/specializations/mechanist/module.js';
import { scrapperModule } from '#gw2/professions/engineer/specializations/scrapper/module.js';

// Kept apart from profession.ts because build/ reads the catalog while profession.ts imports build/.
export const engineerNativeModules = Object.freeze([
  engineerCoreModule,
  scrapperModule,
  holosmithModule,
  mechanistModule,
  amalgamModule
] as const);

export const engineerCatalog = assembleNativeApplicationCatalog(engineerNativeModules);
