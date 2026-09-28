import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { startVindicatorDodge } from '#gw2/professions/revenant/specializations/vindicator/hooks.js';
import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { revenantCoreModule } from '#gw2/professions/revenant/core/module.js';
import { conduitModule } from '#gw2/professions/revenant/specializations/conduit/module.js';
import { heraldModule } from '#gw2/professions/revenant/specializations/herald/module.js';
import { renegadeModule } from '#gw2/professions/revenant/specializations/renegade/module.js';
import { vindicatorModule } from '#gw2/professions/revenant/specializations/vindicator/module.js';

// Kept apart from profession.ts because build/ reads the catalog while profession.ts imports build/.
export const revenantNativeModules = Object.freeze([
  // Dodge is Core-owned in every catalog, so register its guarded elite action at the family boundary.
  defineNativeModule({
    ...revenantCoreModule,
    hooks: {
      ...revenantCoreModule.hooks,
      sideEffectHandlers: {
        ...revenantCoreModule.hooks?.sideEffectHandlers,
        'revenant.vindicator-dodge'(runtime, context) {
          if (context.kind === 'cast') startVindicatorDodge(runtime, context.cast);
        }
      }
    }
  }),
  heraldModule,
  renegadeModule,
  vindicatorModule,
  conduitModule
] as const);

export const revenantCatalog = assembleNativeApplicationCatalog(revenantNativeModules);
