import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import {
  spellbreakerBuffPolicies,
  spellbreakerEffectStates
} from '#gw2/professions/warrior/specializations/spellbreaker/effect-state.js';
import { spellbreakerReactions } from '#gw2/professions/warrior/specializations/spellbreaker/mechanics/combat.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Spellbreaker supplies its selected cap before the shared controller seeds initial adrenaline. */
const spellbreakerAdrenalinePolicy: typeof coreAdrenalinePolicy = {
  ...coreAdrenalinePolicy,
  maximum: (runtime) => balanceNumberFromContext(runtime, PROFILE.resources, 'maximumStacks')
};

/** Core owns packet execution and one-bar spending; this slice owns accepted control and burst reactions. */
export const spellbreakerHooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  /** Hold the selected preview state while evaluating detached damage queries. */
  prepareDamageState(runtime, _skill, inputs) {
    spellbreakerState.from(runtime).magebaneTetherUntil = inputs.magebaneTether ? Infinity : 0;
    // Hold the selected Insight stacks for isolated damage queries using the native attribute owner.
    spellbreakerState.from(runtime).attackerInsightExpiries = Array.from(
      { length: Number(inputs.attackersInsight) || 0 },
      () => Infinity
    );
  },
  buffPolicies: spellbreakerBuffPolicies,
  observeEffects: spellbreakerEffectStates,
  resources: { adrenaline: spellbreakerAdrenalinePolicy },
  reactions: spellbreakerReactions
};
