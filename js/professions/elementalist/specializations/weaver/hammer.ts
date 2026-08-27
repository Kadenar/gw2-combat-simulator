import { emitSkillBuff } from '../../../../platform/gw2/scheduler/skill-events.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import type { Skill } from '../../../../platform/engine/types.js';
import type { ElementalistCastContext, ElementalistPrecastContext } from '../../types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '../../core/state.js';
import { activeHammerOrbElements } from '../../core/hammer.js';
import { activeBuffEvents, skillWeapon } from '../../core/mechanics.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE,
  elementalistBalanceValue
} from '../../core/profiles.js';
import { weaverDualAttunements } from './skills.js';
import { weaverState } from './state.js';

/** Creates and refreshes the two hammer orbs granted by a Weaver dual skill. */
export function applyWeaverHammerState(context: ElementalistCastContext, skill: Skill): void {
  if (skillWeapon(skill) !== 'Hammer') return;
  const elements = weaverDualAttunements(skill);
  if (!elements) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const orbDuration = elementalistBalanceValue(context, CORE_PROFILE.hammerOrbs, 'durationMultiplier', 15);
  const previouslyActive = new Set(activeHammerOrbElements(state, at));
  for (const element of ELEMENTALIST_ATTUNEMENTS) {
    const expiresAt = state.hammerOrbs[element];
    if (expiresAt == null || expiresAt < at) continue;
    state.hammerOrbs[element] = at + orbDuration;
    for (const event of activeBuffEvents(context, `hammer ${element} orb`, at)) {
      context.replaceEvent(event, { duration: at + orbDuration - event.at });
    }
  }

  for (const element of elements) {
    state.hammerOrbs[element] = at + orbDuration;
    state.hammerOrbGrantedBy[element] = skill.name;
    state.hammerOrbActivationIds[element] = context.reservationId;
    state.hammerOrbBuffUntil[element] = at + orbDuration;
    if (!previouslyActive.has(element)) {
      emitSkillBuff(context, skill, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        kind: `hammer ${element.toLowerCase()} orb`,
        stacks: 1,
        duration: orbDuration,
        skillName: skill.name
      });
    }
  }

  state.hammerOrbLastCastAt = at;
}

/** Checks the shared orb lockout and duplicate-orb restriction for Weaver dual skills. */
export function weaverHammerAvailability(
  context: ElementalistPrecastContext,
  skill: Skill
): { ready: boolean; retryAt?: number | null; code?: string; reason?: string } | null {
  if (skillWeapon(skill) !== 'Hammer') return null;
  const elements = weaverDualAttunements(skill);
  if (!elements) return null;
  const state = professionCoreState(context);
  const retryAt =
    state.hammerOrbLastCastAt + elementalistBalanceValue(context, CORE_PROFILE.hammerOrbs, 'initialDelay', 0.48);
  if (retryAt > context.start + context.epsilon) {
    return {
      ready: false,
      retryAt,
      code: 'elementalist.hammer-orb-lockout',
      reason: `${skill.name} is unavailable - the shared orb lockout ends at ${retryAt.toFixed(3)}.`
    };
  }

  if (
    elements.some((element) => state.hammerOrbs[element] != null && Number(state.hammerOrbs[element]) >= context.start)
  ) {
    return {
      ready: false,
      retryAt: null,
      code: 'elementalist.hammer-orb-active',
      reason: `${skill.name} is unavailable - Grand Finale must consume the active orb first.`
    };
  }

  const secondary = weaverState.from(context).secondaryAttunement || state.primaryAttunement;
  return elements.includes(state.primaryAttunement) && elements.includes(secondary)
    ? { ready: true }
    : {
        ready: false,
        retryAt: null,
        code: 'elementalist.weaver-attunement',
        reason: `${skill.name} is unavailable - requires its matching dual attunement.`
      };
}
