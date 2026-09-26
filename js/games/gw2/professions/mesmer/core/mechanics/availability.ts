import { skillFlipVisible } from '#gw2/platform/engine/skills/skill-flips.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { selectedSlotSkillAvailability } from '#gw2/professions/shared/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// Flip windows open exactly at availability and close at expiry, independently of cooldown readiness tolerance.
export function mesmerAvailability(context: MesmerRuntime, skill: MesmerSkill): AvailabilityResult {
  const selection = selectedSlotSkillAvailability({ config: context.config, catalog: context.helpers }, skill);
  if (selection) return selection;
  const runtime = mesmerMechanicsFor(context);
  const state = context;
  const at = canonicalTime(context.time);
  if (skill.flipParentId) {
    const flip = professionCoreState(state).availableFlips[skill.id];
    if (!skillFlipVisible(flip, at)) {
      const parent = runtime.skillsById.get(skill.flipParentId);
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

    if (flip.availableAt > at) {
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
