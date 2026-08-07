import { mesmerCoreModule } from "./core/module.js";
import { chronomancerModule } from "./specializations/chronomancer/module.js";
import { mirageModule } from "./specializations/mirage/module.js";
import { troubadourModule } from "./specializations/troubadour/module.js";
import { virtuosoModule } from "./specializations/virtuoso/module.js";

export const mesmerNativeModules = Object.freeze([
  mesmerCoreModule,
  chronomancerModule,
  mirageModule,
  virtuosoModule,
  troubadourModule,
] as const);
