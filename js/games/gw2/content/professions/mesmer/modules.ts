import { mesmerCoreModule } from '#gw2/content/professions/mesmer/core/module.js';
import { chronomancerModule } from '#gw2/content/professions/mesmer/specializations/chronomancer/module.js';
import { mirageModule } from '#gw2/content/professions/mesmer/specializations/mirage/module.js';
import { troubadourModule } from '#gw2/content/professions/mesmer/specializations/troubadour/module.js';
import { virtuosoModule } from '#gw2/content/professions/mesmer/specializations/virtuoso/module.js';

export const mesmerNativeModules = Object.freeze([
  mesmerCoreModule,
  chronomancerModule,
  mirageModule,
  virtuosoModule,
  troubadourModule
] as const);
