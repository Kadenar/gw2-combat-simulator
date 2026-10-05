import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  spellbreakerBuffPolicies,
  spellbreakerEffectStates
} from '#gw2/professions/warrior/specializations/spellbreaker/effect-state.js';
import { spellbreakerAdrenalinePolicy } from '#gw2/professions/warrior/specializations/spellbreaker/mechanics/resources.js';
import {
  reactToSpellbreakerControl,
  reactToSpellbreakerDamage
} from '#gw2/professions/warrior/specializations/spellbreaker/traits/behavior.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Core owns packet execution and one-bar spending; this slice owns accepted control and burst reactions. */
export const spellbreakerHooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  buffPolicies: spellbreakerBuffPolicies,
  observeEffects: spellbreakerEffectStates,
  resources: { adrenaline: spellbreakerAdrenalinePolicy },
  // Queue No Escape from accepted player control; Insight still updates before the condition resolves.

  reactions: {
    'control.resolved': reactToSpellbreakerControl,
    // The resolver checks committed recharge before admitting each tether opportunity.
    'damage.resolved': reactToSpellbreakerDamage
  }
};
