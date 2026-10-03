import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { refreshElementalistBuffs } from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
/**
 * Owns Core hammer orb state, availability, and consumption.
 *
 * Owns the orb timers the hammer attunement skills create and the Grand Finale
 * consumption that spends them, plus the queries availability uses to gate both.
 * Hammer skill effects, including Grand Finale's projectiles, live in `skills/weapons/hammer.ts`.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  type ElementalistAttunement,
  type ElementalistCoreState
} from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
/** Orb elements still live at `at`; shared by availability gating and the Weaver orb handler. */
export function activeHammerOrbElements(state: ElementalistCoreState, at: number): ElementalistAttunement[] {
  return ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= at;
  });
}

/** Core compatibility rule for spending an orb: only one matching the current primary attunement counts. */
export function hammerOrbMatchesAttunement(state: ElementalistCoreState, element: ElementalistAttunement): boolean {
  return element === state.primaryAttunement;
}

/** Core and Weaver refresh live orbs together, emitting buffs only for newly created elements. */
export function createHammerOrbs(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  elements: readonly ElementalistAttunement[]
): void {
  const state = professionCoreState(context);
  const at = cast.effectiveEnd;
  const profile = requireBalanceProfileFromContext(context, PROFILE.hammerOrbs);
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  const previouslyActive = new Set(activeHammerOrbElements(state, at));
  for (const element of previouslyActive) {
    state.hammerOrbs[element] = at + duration;
    refreshElementalistBuffs(context, `hammer ${element} orb`, at, () => at + duration);
  }

  for (const element of elements) {
    state.hammerOrbs[element] = at + duration;
    state.hammerOrbActivationIds[element] = cast.id;
    if (!previouslyActive.has(element)) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill,
            at,
            source: skill.name,
            sourceId: skill.id,
            actorType: 'player',
            kind: `hammer ${element.toLowerCase()} orb`,
            stacks: 1,
            duration,
            skillName: skill.name
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  }

  context.schedule('elementalist.expire-state', at + duration, null, undefined, 50);
  state.hammerOrbLastCastAt = at;
}

/** Finale consumes stored orbs while keeping their buffs alive through its last packet. */
export function consumeHammerOrbs(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const state = professionCoreState(context);
  const at = cast.effectiveEnd;
  const active = ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= cast.start;
  });
  for (const element of active) {
    refreshElementalistBuffs(context, `hammer ${element} orb`, at, () => at + 1);
    state.hammerOrbs[element] = null;
    state.hammerOrbActivationIds[element] = null;
  }
}
