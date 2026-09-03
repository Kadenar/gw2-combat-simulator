import { necromancerCoreModule } from '#gw2/professions/necromancer/core/module.js';
import { harbingerModule } from '#gw2/professions/necromancer/specializations/harbinger/module.js';
import { reaperModule } from '#gw2/professions/necromancer/specializations/reaper/module.js';
import { ritualistModule } from '#gw2/professions/necromancer/specializations/ritualist/module.js';
import { scourgeModule } from '#gw2/professions/necromancer/specializations/scourge/module.js';

export const necromancerNativeModules = Object.freeze([
  necromancerCoreModule,
  reaperModule,
  scourgeModule,
  harbingerModule,
  ritualistModule
] as const);
