import { rangerCoreModule } from './core/module.js';
import { druidModule } from './specializations/druid/module.js';
import { galeshotModule } from './specializations/galeshot/module.js';
import { soulbeastModule } from './specializations/soulbeast/module.js';
import { untamedModule } from './specializations/untamed/module.js';

export const rangerNativeModules = Object.freeze([
  rangerCoreModule,
  druidModule,
  soulbeastModule,
  untamedModule,
  galeshotModule
] as const);
