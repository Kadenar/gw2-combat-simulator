import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  berserkerBuffPolicies,
  berserkerEffectStates
} from '#gw2/professions/warrior/specializations/berserker/effect-state.js';
import { berserkLifecycle } from '#gw2/professions/warrior/specializations/berserker/mechanics/berserk.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Register the complete mode lifecycle with its public buff and effect policies. */
export const berserkerHooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  ...berserkLifecycle,
  buffPolicies: berserkerBuffPolicies,
  observeEffects: berserkerEffectStates
};
