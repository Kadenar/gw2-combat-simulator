import { warriorCoreModule } from '#gw2/professions/warrior/core/module.js';
import { berserkerModule } from '#gw2/professions/warrior/specializations/berserker/module.js';
import { spellbreakerModule } from '#gw2/professions/warrior/specializations/spellbreaker/module.js';
import { bladeswornModule } from '#gw2/professions/warrior/specializations/bladesworn/module.js';
import { paragonModule } from '#gw2/professions/warrior/specializations/paragon/module.js';

export const warriorNativeModules = Object.freeze([
  warriorCoreModule,
  berserkerModule,
  spellbreakerModule,
  bladeswornModule,
  paragonModule
] as const);
