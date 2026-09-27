import { refreshElementalistBuffs } from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/**
 * Owns Core hammer orb state, availability, and consumption.
 *
 * Owns the orb timers the hammer attunement skills create and the Grand Finale
 * consumption that spends them, plus the queries availability uses to gate both.
 * Hammer skill effects, including Grand Finale's projectiles, live in `skills/weapons/hammer.ts`.
 */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitElementalistBuff } from '#gw2/professions/elementalist/core/events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  type ElementalistAttunement,
  type ElementalistCoreState
} from '#gw2/professions/elementalist/core/state.js';
import { HAMMER_ORB_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
import { skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

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

/**
 * Creating an orb refreshes all active orb windows; Grand Finale consumes the
 * stored orbs while leaving their visible buffs alive for the final packet.
 *
 * Cast-completion owner of the orb timers and of the buff events that mirror
 * them on the log timeline.
 */
export function applyHammerState(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (skillWeapon(skill) !== 'Hammer') return;
  const state = professionCoreState(context);
  const at = cast.effectiveEnd;
  const single = HAMMER_ORB_SKILLS[Number(skill.id)];
  if (single) {
    const hammerOrbsProfile = requireBalanceProfileFromContext(context, PROFILE.hammerOrbs);
    const orbDuration = balanceProfileNumber(hammerOrbsProfile, 'durationMultiplier');
    const previouslyActive = new Set(activeHammerOrbElements(state, at));
    // Refresh every live orb's window and stretch the buff event already on the timeline.
    for (const [element, expiresAt] of Object.entries(state.hammerOrbs)) {
      if (expiresAt != null && expiresAt >= at) {
        state.hammerOrbs[element as ElementalistAttunement] = at + orbDuration;
        refreshElementalistBuffs(context, `hammer ${element} orb`, at, () => at + orbDuration);
      }
    }

    for (const element of [single]) {
      state.hammerOrbs[element] = at + orbDuration;
      state.hammerOrbActivationIds[element] = cast.id;
      // Only a newly created orb emits a buff; a refresh extended the existing one above.
      if (!previouslyActive.has(element)) {
        emitElementalistBuff(context, {
          skill: skill,
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

    context.schedule('elementalist.expire-state', at + orbDuration, null, undefined, 50);
    state.hammerOrbLastCastAt = at;
    return;
  }

  // Grand Finale clears the stored orbs and trims their buffs to just past the
  // cast instead of ending them instantly, so the finisher still reads as covered.
  if (skill.id !== ID.GRAND_FINALE) return;
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
