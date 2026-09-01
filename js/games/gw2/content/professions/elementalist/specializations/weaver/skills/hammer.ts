/**
 * Weaver-side runtime behaviour for the hammer orbs that dual skills create and
 * Grand Finale consumes; the cataloged hammer skill data lives in
 * `skills/weapons/hammer.ts`.
 */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type {
  ElementalistCastContext,
  ElementalistPrecastContext
} from '#gw2/content/professions/elementalist/types.js';
import { ELEMENTALIST_ATTUNEMENTS } from '#gw2/content/professions/elementalist/core/state.js';
import { activeHammerOrbElements } from '#gw2/content/professions/elementalist/core/skills/hammer.js';
import { activeBuffEvents, skillWeapon } from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';
import { weaverDualAttunements } from '#gw2/content/professions/elementalist/specializations/weaver/skills/index.js';
import { weaverState } from '#gw2/content/professions/elementalist/specializations/weaver/state.js';

/** Creates and refreshes the two hammer orbs granted by a Weaver dual skill. */
export function applyWeaverHammerState(context: ElementalistCastContext, skill: Skill): void {
  if (skillWeapon(skill) !== 'Hammer') return;
  const elements = weaverDualAttunements(skill);
  if (!elements) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const orbDuration = balanceProfileValueFromContext(context, CORE_PROFILE.hammerOrbs, 'durationMultiplier', 15);
  // Any orb still alive is extended to the new full duration, including the
  // buff events already placed on the timeline.
  const previouslyActive = new Set(activeHammerOrbElements(state, at));
  for (const element of ELEMENTALIST_ATTUNEMENTS) {
    const expiresAt = state.hammerOrbs[element];
    if (expiresAt == null || expiresAt < at) continue;
    state.hammerOrbs[element] = at + orbDuration;
    for (const event of activeBuffEvents(context, `hammer ${element} orb`, at)) {
      context.replaceEvent(event, { duration: at + orbDuration - event.at });
    }
  }

  // The cast's own pair is (re)created and attributed to this activation; the
  // buff is only emitted for an element that was not already orbiting.
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
  // Every dual hammer skill shares one short lockout after the last orb cast.
  const retryAt =
    state.hammerOrbLastCastAt + balanceProfileValueFromContext(context, CORE_PROFILE.hammerOrbs, 'initialDelay', 0.48);
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

  // Final gate: the skill's element pair must match the two attuned hands.
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
