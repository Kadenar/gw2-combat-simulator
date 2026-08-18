import { guardianCoreModule } from './core/module.js';
import { dragonhunterModule } from './specializations/dragonhunter/module.js';
import { firebrandModule } from './specializations/firebrand/module.js';
import { luminaryModule } from './specializations/luminary/module.js';
import { willbenderModule } from './specializations/willbender/module.js';

export const guardianNativeModules = Object.freeze([
  guardianCoreModule,
  dragonhunterModule,
  firebrandModule,
  willbenderModule,
  luminaryModule
] as const);
