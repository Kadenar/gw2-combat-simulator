/**
 * Evoker cast gating.
 *
 * Decides whether attunement swaps and familiar skills may start, and doubles as
 * the capture point for the pre-swap attunement recharge snapshot that
 * `attunements.ts` later consumes.
 */
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { AvailabilityResult, Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistPrecastContext } from '#gw2/content/professions/elementalist/types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  isElementalistAttunement,
  type ElementalistAttunement
} from '#gw2/content/professions/elementalist/core/state.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/content/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerState } from '#gw2/content/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/specializations/evoker/profiles.js';
import { elementalistBalanceValue } from '#gw2/content/professions/elementalist/core/profiles.js';

// derives the destination element from an attunement swap skill's name, or null for any other skill
function targetAttunement(skill: Skill): ElementalistAttunement | null {
  if (skill.skillFamily !== 'Attunement') return null;
  const target = skill.name.replace(/ Attunement$/, '');
  return isElementalistAttunement(target) ? target : null;
}

/**
 * The single Evoker availability gate. Only the in-flight familiar cast yields a
 * time-based denial (`retryAt` set, so the scheduler waits and re-checks); every
 * other denial carries `retryAt: null` and is final for this command.
 */
export function availability(context: ElementalistPrecastContext, skill: Skill): AvailabilityResult {
  const state = evokerState.from(context);
  const attunement = targetAttunement(skill);
  if (attunement) {
    if (hasTrait(context, 'Specialized Elements')) {
      return {
        ready: false,
        retryAt: null,
        code: 'elementalist.specialized-elements',
        reason: `${skill.name} is unavailable - attunement swapping is disabled by Specialized Elements.`
      };
    }

    // capture remaining recharge before the swap fires so applyEvokerAttunementRechargePolicy can preserve shorter cooldowns
    if (!state.pendingOffAttunementRemainingByCommand[context.commandIndex]) {
      const core = professionCoreState(context);
      state.pendingOffAttunementRemainingByCommand[context.commandIndex] = Object.fromEntries(
        ELEMENTALIST_ATTUNEMENTS.map((element) => [
          element,
          Math.max(0, Number(core.attunementReadyAt[element] || 0) - context.start)
        ])
      );
    }
  }

  // the one retryable denial: nothing may start until the familiar cast in flight ends
  if (state.activeFamiliarCast && context.start < state.activeFamiliarCast.endsAt - context.epsilon) {
    return {
      ready: false,
      retryAt: state.activeFamiliarCast.endsAt,
      code: 'elementalist.evoker-familiar-cast',
      reason: `${skill.name} waits for the active familiar cast to finish.`
    };
  }

  // anything that is not a familiar skill is unconstrained by Evoker state
  const element = FAMILIAR_ELEMENTS[skill.name];
  if (!element) return { ready: true };
  if (state.element !== element) {
    return {
      ready: false,
      retryAt: null,
      code: 'elementalist.evoker-element',
      reason: `${skill.name} is unavailable - the ${element} familiar is not selected.`
    };
  }

  // basic familiar requires a full charge bar and no empowered stack (empowered means the flip form is active)
  if (BASIC_FAMILIARS.has(skill.name)) {
    const requiredEmpowered = elementalistBalanceValue(context, PROFILE.resources, 'minimumStacks', 3);
    return state.empowered < requiredEmpowered && state.charges >= state.maximumCharges
      ? { ready: true }
      : {
          ready: false,
          retryAt: null,
          code: 'elementalist.evoker-basic',
          reason: `${skill.name} is unavailable - requires ${state.maximumCharges} charges and no empowered familiar.`
        };
  }

  // empowered familiar requires 3 empowered stacks built up from basic familiar casts
  const requiredEmpowered = elementalistBalanceValue(context, PROFILE.resources, 'minimumStacks', 3);
  return state.empowered >= requiredEmpowered
    ? { ready: true }
    : {
        ready: false,
        retryAt: null,
        code: 'elementalist.evoker-empowered',
        reason: `${skill.name} is unavailable - requires three empowered charges.`
      };
}
