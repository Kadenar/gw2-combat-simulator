import { engineerCoreModule } from './core/module.js';
import { amalgamModule } from './specializations/amalgam/module.js';
import { holosmithModule } from './specializations/holosmith/module.js';
import { mechanistModule } from './specializations/mechanist/module.js';
import { scrapperModule } from './specializations/scrapper/module.js';

export const engineerNativeModules = Object.freeze([
  engineerCoreModule,
  scrapperModule,
  holosmithModule,
  mechanistModule,
  amalgamModule
] as const);
