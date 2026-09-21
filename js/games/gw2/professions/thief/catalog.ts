import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { thiefCoreModule } from '#gw2/professions/thief/core/module.js';
import { antiquaryModule } from '#gw2/professions/thief/specializations/antiquary/module.js';
import { daredevilModule } from '#gw2/professions/thief/specializations/daredevil/module.js';
import { deadeyeModule } from '#gw2/professions/thief/specializations/deadeye/module.js';
import { specterModule } from '#gw2/professions/thief/specializations/specter/module.js';

// Kept apart from profession.ts because build/ reads the catalog while profession.ts imports build/.
export const thiefNativeModules = Object.freeze([
  thiefCoreModule,
  daredevilModule,
  deadeyeModule,
  specterModule,
  antiquaryModule
] as const);

export const thiefCatalog = assembleNativeApplicationCatalog(thiefNativeModules);
