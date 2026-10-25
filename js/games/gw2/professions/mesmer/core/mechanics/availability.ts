import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { preparedMagazineOpen } from '#gw2/platform/execution/prepared-magazines.js';
import { skillFlipVisible } from '#gw2/platform/execution/skill-flips.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// Flip windows open exactly at availability and close at expiry, independently of cooldown readiness tolerance.
export function mesmerAvailability(context: MechanicQueriesOf<MesmerRuntime>, skill: MesmerSkill): AvailabilityResult {
  const state = context;
  const at = canonicalTime(context.time);

  if (skill.flipParentId) {
    const flip = professionCoreState(state).availableFlips[skill.id];

    if (!skillFlipVisible(flip, at)) {
      const parent = context.helpers.skillsById.get(skill.flipParentId);

      if (parent && context.castController.hasInFlight(parent.id)) {
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

  // A prepared mantra replaces its parent on the bar, so the parent cannot channel again until its charges are spent.
  const preparedFlip =
    skill.flipSkillId == null ? undefined : context.helpers.skillsById.get(Number(skill.flipSkillId));

  if (
    preparedFlip?.flipParentId === skill.id &&
    Number(preparedFlip.ammo) > 0 &&
    preparedMagazineOpen(professionCoreState(state).availableFlips, { faceIds: [preparedFlip.id] })
  ) {
    return {
      ready: false,
      retryAt: null,
      code: 'mesmer.mantra-prepared',
      reason: `${skill.name} is already prepared.`
    };
  }

  return { ready: true };
}
