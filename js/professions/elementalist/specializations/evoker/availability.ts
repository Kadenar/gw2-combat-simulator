import { hasTrait as hasGw2Trait } from '../../../../platform/gw2/trait-state.js';
import type { AvailabilityResult, SchedulerRecord, Skill } from '../../../../platform/engine/types.js';
import type { ElementalistPrecastContext } from '../../types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  elementalistCoreState,
  isElementalistAttunement,
  type ElementalistAttunement
} from '../../core/state.js';
import { BASIC_FAMILIARS, FAMILIAR_ELEMENTS } from './constants.js';
import { evokerState } from './state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { elementalistBalanceValue } from '../../core/profiles.js';

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

function targetAttunement(skill: Skill): ElementalistAttunement | null {
  if (skill.skillFamily !== 'Attunement') return null;
  const target = skill.name.replace(/ Attunement$/, '');
  return isElementalistAttunement(target) ? target : null;
}

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
      const core = elementalistCoreState(context as unknown as SchedulerRecord);
      state.pendingOffAttunementRemainingByCommand[context.commandIndex] = Object.fromEntries(
        ELEMENTALIST_ATTUNEMENTS.map((element) => [
          element,
          Math.max(0, Number(core.attunementReadyAt[element] || 0) - context.start)
        ])
      );
    }
  }

  if (state.activeFamiliarCast && context.start < state.activeFamiliarCast.endsAt - context.epsilon) {
    return {
      ready: false,
      retryAt: state.activeFamiliarCast.endsAt,
      code: 'elementalist.evoker-familiar-cast',
      reason: `${skill.name} waits for the active familiar cast to finish.`
    };
  }

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
