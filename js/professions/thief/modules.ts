import { thiefCoreModule } from "./core/module.js";
import { antiquaryModule } from "./specializations/antiquary/module.js";
import { daredevilModule } from "./specializations/daredevil/module.js";
import { deadeyeModule } from "./specializations/deadeye/module.js";
import { specterModule } from "./specializations/specter/module.js";

export const thiefNativeModules = Object.freeze([
  thiefCoreModule,
  daredevilModule,
  deadeyeModule,
  specterModule,
  antiquaryModule,
] as const);
