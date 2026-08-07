import { revenantCoreModule } from "./core/module.js";
import { conduitModule } from "./specializations/conduit/module.js";
import { heraldModule } from "./specializations/herald/module.js";
import { renegadeModule } from "./specializations/renegade/module.js";
import { vindicatorModule } from "./specializations/vindicator/module.js";

export const revenantNativeModules = Object.freeze([
  revenantCoreModule,
  heraldModule,
  renegadeModule,
  vindicatorModule,
  conduitModule,
] as const);
