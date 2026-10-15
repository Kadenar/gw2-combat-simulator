import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  spellbreakerBuffPolicies,
  spellbreakerEffectStates
} from '#gw2/professions/warrior/specializations/spellbreaker/effect-state.js';
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
  // Queue No Escape from accepted player control; Insight still updates before the condition resolves.

  reactions: {
    'control.resolved'(runtime, event) {
      runtime.fireTrigger(spellbreakerControlAccepted, { event });
    },
    // The resolver checks committed recharge before admitting each tether opportunity.
    'damage.resolved'(runtime, event) {
      runtime.fireTrigger(spellbreakerStrike, { event });
    }
  }
};

/** Resolve this accepted event at the specialization hook position. */
export const spellbreakerControlAccepted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.spellbreaker-control-accepted',
  [TRAIT.ATTACKERS_INSIGHT]
);

/** Resolve this accepted event at the specialization hook position. */
export const spellbreakerStrike = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.spellbreaker-strike',
  [TRAIT.MAGEBANE_TETHER]
);
