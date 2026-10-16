import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { tempestBuffPolicies } from '#gw2/professions/elementalist/specializations/tempest/effect-state.js';
import {
  registerTempestLightningJolt,
  tempestLightningJoltLifecycle
} from '#gw2/professions/elementalist/specializations/tempest/mechanics/lightning-jolt.js';
import {
  startTempestOverload,
  completeTempestOverload,
  observeTempestAttunement,
  tempestOverloadLifecycle
} from '#gw2/professions/elementalist/specializations/tempest/mechanics/overloads.js';
import {
  tempestCastCompleted,
  tempestCastCompleting,
  tempestCastStarted
} from '#gw2/professions/elementalist/specializations/tempest/mechanics/trigger-points.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Register overload and Lightning Jolt owners while preserving trait ordering at cast boundaries. */
export const tempestHooks = composeRuntimeHooks<ElementalistRuntimeState, ElementalistSkill>([
  tempestOverloadLifecycle,
  tempestLightningJoltLifecycle,
  {
    buffPolicies: tempestBuffPolicies,
    initialize(runtime) {
      registerElementalistEliteEvents(runtime, observeTempestAttunement);
      registerTempestLightningJolt(runtime);
    },
    onCastStart(runtime, cast) {
      startTempestOverload(runtime, cast, cast.skill);
      runtime.fireTrigger(tempestCastStarted, { cast });
    },
    onCastCommit(runtime, cast) {
      runtime.fireTrigger(tempestCastCompleting, { cast });
      completeTempestOverload(runtime, cast, cast.skill);
      runtime.fireTrigger(tempestCastCompleted, { cast });
    }
  }
]);
