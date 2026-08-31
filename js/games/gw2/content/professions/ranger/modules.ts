import { rangerCoreModule } from '#gw2/content/professions/ranger/core/module.js';
import { druidModule } from '#gw2/content/professions/ranger/specializations/druid/module.js';
import { galeshotModule } from '#gw2/content/professions/ranger/specializations/galeshot/module.js';
import { soulbeastModule } from '#gw2/content/professions/ranger/specializations/soulbeast/module.js';
import { untamedModule } from '#gw2/content/professions/ranger/specializations/untamed/module.js';

export const rangerNativeModules = Object.freeze([
  rangerCoreModule,
  druidModule,
  soulbeastModule,
  untamedModule,
  galeshotModule
] as const);
