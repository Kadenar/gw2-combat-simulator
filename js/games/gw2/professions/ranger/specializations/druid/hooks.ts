import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { druidBuffPolicies } from '#gw2/professions/ranger/specializations/druid/effect-state.js';
import { celestialAvatarLifecycle } from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Register the complete mechanic lifecycle alongside its public buff policies. */
export const druidHooks = composeRuntimeHooks<RangerRuntimeState, RangerSkill>([
  celestialAvatarLifecycle,
  { buffPolicies: druidBuffPolicies }
]);
