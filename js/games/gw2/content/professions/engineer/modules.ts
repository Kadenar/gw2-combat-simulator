import { engineerCoreModule } from '#gw2/content/professions/engineer/core/module.js';
import { amalgamModule } from '#gw2/content/professions/engineer/specializations/amalgam/module.js';
import { holosmithModule } from '#gw2/content/professions/engineer/specializations/holosmith/module.js';
import { mechanistModule } from '#gw2/content/professions/engineer/specializations/mechanist/module.js';
import { scrapperModule } from '#gw2/content/professions/engineer/specializations/scrapper/module.js';

export const engineerNativeModules = Object.freeze([
  engineerCoreModule,
  scrapperModule,
  holosmithModule,
  mechanistModule,
  amalgamModule
] as const);
