import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import type { ActionContext } from '#gw2/platform/effects/actions.js';
import { scheduleLanding } from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';
import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { revenantCoreModule } from '#gw2/professions/revenant/core/module.js';
import { conduitModule } from '#gw2/professions/revenant/specializations/conduit/module.js';
import { heraldModule } from '#gw2/professions/revenant/specializations/herald/module.js';
import { renegadeModule } from '#gw2/professions/revenant/specializations/renegade/module.js';
import { vindicatorModule } from '#gw2/professions/revenant/specializations/vindicator/module.js';

// Kept apart from profession.ts because build/ reads the catalog while profession.ts imports build/.
export const revenantNativeModules = Object.freeze([
  // Dodge is Core-owned in every catalog, so register its guarded elite action at the family boundary.
  Object.freeze({
    ...revenantCoreModule,
    hooks: {
      ...revenantCoreModule.hooks,
      sideEffectHandlers: {
        ...revenantCoreModule.hooks?.sideEffectHandlers,
        'revenant.vindicator-dodge'(runtime: RevenantRuntime, context: ActionContext<RevenantSkill>) {
          if (context.kind === 'cast') scheduleLanding(runtime, context.cast, context.cast.start);
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
