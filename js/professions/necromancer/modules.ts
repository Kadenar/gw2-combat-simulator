import { necromancerCoreModule } from "./core/module.js";
import { harbingerModule } from "./specializations/harbinger/module.js";
import { reaperModule } from "./specializations/reaper/module.js";
import { ritualistModule } from "./specializations/ritualist/module.js";
import { scourgeModule } from "./specializations/scourge/module.js";

export const necromancerNativeModules = Object.freeze([
  necromancerCoreModule,
  reaperModule,
  scourgeModule,
  harbingerModule,
  ritualistModule,
] as const);
