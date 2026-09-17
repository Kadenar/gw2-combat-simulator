import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { necromancerCoreModule } from '#gw2/professions/necromancer/core/module.js';
import { harbingerModule } from '#gw2/professions/necromancer/specializations/harbinger/module.js';
import { reaperModule } from '#gw2/professions/necromancer/specializations/reaper/module.js';
import { ritualistModule } from '#gw2/professions/necromancer/specializations/ritualist/module.js';
import { scourgeModule } from '#gw2/professions/necromancer/specializations/scourge/module.js';

// Kept apart from profession.ts because build/ reads the catalog while profession.ts imports build/.
export const necromancerNativeModules = Object.freeze([
  necromancerCoreModule,
  reaperModule,
  scourgeModule,
  harbingerModule,
  ritualistModule
] as const);

export const necromancerCatalog = assembleNativeApplicationCatalog(necromancerNativeModules);
