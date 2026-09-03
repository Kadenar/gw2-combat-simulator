import { revenantCoreModule } from '#gw2/professions/revenant/core/module.js';
import { conduitModule } from '#gw2/professions/revenant/specializations/conduit/module.js';
import { heraldModule } from '#gw2/professions/revenant/specializations/herald/module.js';
import { renegadeModule } from '#gw2/professions/revenant/specializations/renegade/module.js';
import { vindicatorModule } from '#gw2/professions/revenant/specializations/vindicator/module.js';

export const revenantNativeModules = Object.freeze([
  revenantCoreModule,
  heraldModule,
  renegadeModule,
  vindicatorModule,
  conduitModule
] as const);
