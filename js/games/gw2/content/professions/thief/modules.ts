import { thiefCoreModule } from '#gw2/content/professions/thief/core/module.js';
import { antiquaryModule } from '#gw2/content/professions/thief/specializations/antiquary/module.js';
import { daredevilModule } from '#gw2/content/professions/thief/specializations/daredevil/module.js';
import { deadeyeModule } from '#gw2/content/professions/thief/specializations/deadeye/module.js';
import { specterModule } from '#gw2/content/professions/thief/specializations/specter/module.js';

export const thiefNativeModules = Object.freeze([
  thiefCoreModule,
  daredevilModule,
  deadeyeModule,
  specterModule,
  antiquaryModule
] as const);
