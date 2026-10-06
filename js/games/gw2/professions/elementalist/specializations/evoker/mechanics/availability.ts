import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { EPSILON } from '#kernel/core/clock.js';
/**
 * Evoker cast gating.
 *
 * Checks current attunement and familiar state; pending work supplies retry
 * boundaries without predicting the resources it will grant.
 */
import { denyCast, retryCast } from '#gw2/platform/execution/availability.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/**
 * Waits for in-flight familiar casts and charge grants; missing resources without
 * a pending grant remain a final denial for this command.
 */
export function availability(context: MechanicQueriesOf<ElementalistRuntime>, skill: Skill): AvailabilityResult {
  const state = evokerState.from(context);
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
    const requiredEmpowered = state.empoweredCharges.maximum;
    // Recorded familiar inputs can precede the simulator's weapon completion; wait for real pending grants.
    if (
      state.empoweredCharges.value < requiredEmpowered &&
      state.familiarCharges.value < state.familiarCharges.maximum
    ) {
      const pending = state.pendingWeaponCompletions
        .filter((grant) => grant.at > context.time + EPSILON)
        .sort((left, right) => left.at - right.at);
      let charges = state.familiarCharges.value;
      for (const grant of pending) {
        charges += grant.gain;
        if (charges >= state.familiarCharges.maximum) {
          return retryCast(
            grant.at,
            'elementalist.evoker-charges',
            `${skill.name} waits for the active cast to supply familiar charges.`
          );
        }
      }
    }

    return state.empoweredCharges.value < requiredEmpowered &&
      state.familiarCharges.value >= state.familiarCharges.maximum
      ? { ready: true }
      : denyCast(
          'elementalist.evoker-basic',
          `${skill.name} is unavailable - requires ${state.familiarCharges.maximum} charges and no empowered familiar.`
        );
  }

  // The selected empowered capacity determines when the flip becomes usable.
  const requiredEmpowered = state.empoweredCharges.maximum;
  return state.empoweredCharges.value >= requiredEmpowered
    ? { ready: true }
    : denyCast(
        'elementalist.evoker-empowered',
        `${skill.name} is unavailable - requires ${requiredEmpowered} empowered charges.`
      );
}
