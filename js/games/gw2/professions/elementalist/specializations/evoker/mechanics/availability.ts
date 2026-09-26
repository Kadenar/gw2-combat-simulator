import { EPSILON } from '#kernel/core/clock.js';
/**
 * Evoker cast gating.
 *
 * Checks current attunement and familiar state; pending work supplies retry
 * boundaries without predicting the resources it will grant.
 */
import { denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { targetAttunement } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

/**
 * Waits for in-flight familiar casts and charge grants; missing resources without
 * a pending grant remain a final denial for this command.
 */
export function availability(context: ElementalistRuntime, skill: Skill): AvailabilityResult {
  const state = evokerState.from(context);
  const attunement = targetAttunement(skill);
  if (attunement) {
    if (hasTrait(context, 'Specialized Elements')) {
      return denyCast(
        'elementalist.specialized-elements',
        `${skill.name} is unavailable - attunement swapping is disabled by Specialized Elements.`
      );
    }
  }

  // Nothing may start until the familiar cast in flight ends.
  if (state.activeFamiliarCast && context.time < state.activeFamiliarCast.endsAt - EPSILON) {
    return retryCast(
      state.activeFamiliarCast.endsAt,
      'elementalist.evoker-familiar-cast',
      `${skill.name} waits for the active familiar cast to finish.`
    );
  }

  // anything that is not a familiar skill is unconstrained by Evoker state
  const element = FAMILIAR_ELEMENTS.get(skill.id);
  if (!element) return { ready: true };
  if (state.element !== element) {
    return denyCast(
      'elementalist.evoker-element',
      `${skill.name} is unavailable - the ${element} familiar is not selected.`
    );
  }

  // basic familiar requires a full charge bar and no empowered stack (empowered means the flip form is active)
  if (BASIC_FAMILIARS.has(skill.id)) {
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    const requiredEmpowered = balanceProfileNumber(resourcesProfile, 'minimumStacks');
    // Recorded familiar inputs can precede the simulator's weapon completion; wait for real pending grants.
    if (state.empowered < requiredEmpowered && state.charges < state.maximumCharges) {
      const pending = state.pendingWeaponCompletions
        .filter((grant) => grant.at > context.time + EPSILON)
        .sort((left, right) => left.at - right.at);
      let charges = state.charges;
      for (const grant of pending) {
        charges += grant.gain;
        if (charges >= state.maximumCharges) {
          return retryCast(
            grant.at,
            'elementalist.evoker-charges',
            `${skill.name} waits for the active cast to supply familiar charges.`
          );
        }
      }
    }

    return state.empowered < requiredEmpowered && state.charges >= state.maximumCharges
      ? { ready: true }
      : denyCast(
          'elementalist.evoker-basic',
          `${skill.name} is unavailable - requires ${state.maximumCharges} charges and no empowered familiar.`
        );
  }

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  // empowered familiar requires 3 empowered stacks built up from basic familiar casts
  const requiredEmpowered = balanceProfileNumber(resourcesProfile, 'minimumStacks');
  return state.empowered >= requiredEmpowered
    ? { ready: true }
    : denyCast('elementalist.evoker-empowered', `${skill.name} is unavailable - requires three empowered charges.`);
}
