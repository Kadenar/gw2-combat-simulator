import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  spellbreakerBuffPolicies,
  spellbreakerEffectStates
} from '#gw2/professions/warrior/specializations/spellbreaker/effect-state.js';
import { spellbreakerAdrenalinePolicy } from '#gw2/professions/warrior/specializations/spellbreaker/mechanics/resources.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Core owns packet execution and one-bar spending; this slice owns accepted control and burst reactions. */
export const spellbreakerHooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  /** Hold the selected preview state while evaluating detached damage queries. */
  prepareDamageState(runtime, _skill, inputs) {
    spellbreakerState.from(runtime).magebaneTetherUntil = inputs.magebaneTether ? Infinity : 0;
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
