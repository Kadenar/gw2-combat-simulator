/** Select family rules once; commitment and deferred reactions share one attunement owner. */
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  ELEMENTALIST_TRANSITION_TASK,
  type ElementalistTransitionDelivery
} from '#gw2/professions/elementalist/core/mechanics/attunement-transition.js';
import { onAttunementComplete, targetAttunement } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { catalystTransitionObserved } from '#gw2/professions/elementalist/specializations/catalyst/mechanics/trigger-points.js';
import {
  applyEvokerAttunementRechargePolicy,
  completeEvokerAttunement
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { evokerEntryObserved } from '#gw2/professions/elementalist/specializations/evoker/mechanics/trigger-points.js';
import { observeTempestAttunement } from '#gw2/professions/elementalist/specializations/tempest/mechanics/overloads.js';
import {
  completeDualAttunement,
  settleWeaverAttunement
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/attunements.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Deferred work preserves the former observation phase without routing mechanics through event payloads. */
export function elementalistAttunementHooks(
  specialization: string
): RuntimeHooks<ElementalistRuntimeState, ElementalistSkill> {
  return {
    onCastCommit(runtime, cast) {
      const target = targetAttunement(cast.skill);

      if (!target) return;

      if (specialization === 'Weaver') completeDualAttunement(runtime, cast);
      else if (specialization === 'Evoker') completeEvokerAttunement(runtime, cast, cast.skill);
      else onAttunementComplete(runtime, cast, cast.skill, target);
    },
    tasks: {
      [ELEMENTALIST_TRANSITION_TASK](runtime, data) {
        const { transition, cause } = data as ElementalistTransitionDelivery;

        if (specialization === 'Tempest') observeTempestAttunement(runtime, { transition, cause });
        else if (specialization === 'Weaver' && transition.kind === 'swap')
          settleWeaverAttunement(runtime, { transition, cause });
        else if (specialization === 'Catalyst' && transition.kind === 'swap')
          runtime.fireTrigger(catalystTransitionObserved, { transition, cause });
        else if (specialization === 'Evoker' && transition.kind !== 'fresh-air') {
          if (transition.kind === 'swap') applyEvokerAttunementRechargePolicy(runtime, transition);

          runtime.fireTrigger(evokerEntryObserved, { transition, cause });
        }
      }
    }
  };
}
