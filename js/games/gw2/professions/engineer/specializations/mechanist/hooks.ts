import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { mechStruck } from '#gw2/professions/engineer/core/mechanics/mech-strikes.js';
import { mechanistCastAvailability } from '#gw2/professions/engineer/specializations/mechanist/mechanics/availability.js';
import { isEngineerMechEvent } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-queries.js';
import {
  copyEngineerMechBoon,
  engineerMechLifecycle
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { overclockRechargeWork } from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import type { EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Register the mech's complete command lifecycle alongside availability, recharge rules, and trait reactions. */
export const mechanistHooks = composeRuntimeHooks<EngineerRuntimeState, EngineerSkill>([
  engineerMechLifecycle,
  {
    // Barrier tracks applications and expiry for trait reactions without modeling incoming damage or health.
    buffPolicies: () => [{ kind: 'barrier', maximumStacks: 1 }],
    availability: mechanistCastAvailability,
    rechargeWork: overclockRechargeWork,
    reactions: {
      'buff.applied': copyEngineerMechBoon,
      'damage.resolved'(runtime, event, details) {
        // Only positive mech strikes reach the mech-owned Firearms trackers and arm rewards.
        if (Number(event.coefficient) > 0 && isEngineerMechEvent(event))
          runtime.fireTrigger(mechStruck, { cause: event, details });
      }
    }
  }
]);
