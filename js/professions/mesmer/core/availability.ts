import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { EPSILON } from '../../../platform/engine/core/clock.js';
import { mesmerRuntimeFor } from './runtime.js';
import type { AvailabilityResult } from '../../../platform/engine/types.js';
import type { MesmerConfig, MesmerPrecastContext, MesmerRuntime, MesmerSkill } from '../types.js';

// Enforce terrestrial, specialization, and weaponmaster restrictions before a
// skill enters either the build UI or runtime availability checks.
export function isMesmerBuildSkillAvailable(
  skill: MesmerSkill,
  config: Pick<MesmerConfig, 'specialization' | 'weaponmasterTraining'>
): boolean {
  if (skill.id < 0) {
    return !skill.specialization || skill.specialization === config.specialization;
  }

  if (skill.environment !== 'Terrestrial') return false;

  if (skill.specialization && skill.type !== 'Weapon' && skill.specialization !== config.specialization) return false;

  if (
    skill.specialization &&
    skill.type === 'Weapon' &&
    !config.weaponmasterTraining &&
    skill.specialization !== config.specialization
  )
    return false;
  return true;
}

// Gate casts by build eligibility and the parent-controlled timing window for
// flip skills; shared GW2 code owns autoattack-chain ordering.
export function mesmerAvailability(
  context: MesmerPrecastContext & {
    readonly mesmerRuntime?: MesmerRuntime;
  },
  skill: MesmerSkill
): AvailabilityResult {
  const runtime = mesmerRuntimeFor(context);
  const { state } = context;
  const at = context.start;

  if (!isMesmerBuildSkillAvailable(skill, context.config)) {
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
