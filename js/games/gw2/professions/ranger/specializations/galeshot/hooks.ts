import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { galeshotBuffPolicies } from '#gw2/professions/ranger/specializations/galeshot/effect-state.js';
import { cycloneBowLifecycle } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Register the complete mechanic lifecycle alongside its public buff policies. */
export const galeshotHooks: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  ...cycloneBowLifecycle,
  buffPolicies: galeshotBuffPolicies
};
