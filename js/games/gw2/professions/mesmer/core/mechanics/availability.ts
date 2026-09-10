import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { EPSILON } from '#kernel/core/clock.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { defaultIsSkillAvailable, selectedSlotSkillAvailability } from '#gw2/professions/lib/availability.js';
import type { AvailabilityResult } from '#gw2/platform/engine/execution/types.js';
import type { MesmerPrecastContext, MesmerRuntime } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// Gate casts by build eligibility and the parent-controlled timing window for
// flip skills; shared GW2 code owns autoattack-chain ordering.
export function mesmerAvailability(
  context: MesmerPrecastContext & {
    readonly mesmerRuntime?: MesmerRuntime;
  },
  skill: MesmerSkill
): AvailabilityResult {
  const selection = selectedSlotSkillAvailability(context, skill);
  if (selection) return selection;
  const runtime = mesmerRuntimeFor(context);
  const { state } = context;
  const at = context.start;
  if (!defaultIsSkillAvailable(skill, context.config)) {
    return {
      ready: false,
      retryAt: null,
      code: 'mesmer.build',
      reason: `${skill.name} is unavailable for this build.`
    };
  }

  if (skill.mesmerMechanic?.flipParentId) {
    const flip = professionCoreState(state).availableFlips[skill.id];
    if (!flip || flip.expiresAt < at - EPSILON) {
      const parent = runtime.skillsById.get(skill.mesmerMechanic?.flipParentId);
      if (parent && context.inFlight.get(parent.id)?.size) {
        return {
          ready: false,
          retryAt: null,
          code: 'mesmer.flip-parent-in-flight',
          reason: `${parent.name} is still channeling.`
        };
      }

      return {
        ready: false,
        retryAt: null,
        code: 'mesmer.flip-not-armed',
        reason: `${parent?.name || 'The parent skill'} is not active.`
      };
    }

    if (flip.availableAt > at + EPSILON) {
      return {
        ready: false,
        retryAt: flip.availableAt,
        code: 'mesmer.flip-not-ready',
        reason: `${skill.name} is not armed until ${flip.availableAt.toFixed(3)}.`
      };
    }
  }

  return { ready: true };
}
