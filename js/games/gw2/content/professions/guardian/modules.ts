import { guardianCoreModule } from '#gw2/content/professions/guardian/core/module.js';
import { dragonhunterModule } from '#gw2/content/professions/guardian/specializations/dragonhunter/module.js';
import { firebrandModule } from '#gw2/content/professions/guardian/specializations/firebrand/module.js';
import { luminaryModule } from '#gw2/content/professions/guardian/specializations/luminary/module.js';
import { willbenderModule } from '#gw2/content/professions/guardian/specializations/willbender/module.js';

export const guardianNativeModules = Object.freeze([
  guardianCoreModule,
  dragonhunterModule,
  firebrandModule,
  willbenderModule,
  luminaryModule
] as const);
