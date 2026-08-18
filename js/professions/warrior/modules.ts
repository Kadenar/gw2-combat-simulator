import { warriorCoreModule } from './core/module.js';
import { berserkerModule } from './specializations/berserker/module.js';
import { spellbreakerModule } from './specializations/spellbreaker/module.js';
import { bladeswornModule } from './specializations/bladesworn/module.js';
import { paragonModule } from './specializations/paragon/module.js';

export const warriorNativeModules = Object.freeze([
  warriorCoreModule,
  berserkerModule,
  spellbreakerModule,
  bladeswornModule,
  paragonModule
] as const);
