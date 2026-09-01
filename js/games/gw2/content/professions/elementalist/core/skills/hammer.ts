/**
 * Core hammer orb mechanics.
 *
 * Owns the orb timers the hammer attunement skills create and the Grand Finale
 * payload that spends them, plus the queries availability uses to gate both.
 * Hammer skill data itself lives in `weapons/hammer.ts`.
 */
import {
  balanceProfileEffectFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type {
  ElementalistCastContext,
  ElementalistPrecastContext
} from '#gw2/content/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  type ElementalistAttunement,
  type ElementalistCoreState
} from '#gw2/content/professions/elementalist/core/state.js';
import { HAMMER_ORB_SKILLS } from '#gw2/content/professions/elementalist/core/constants.js';
import {
  activeBuffEvents,
  emitProfiledCondition,
  skillWeapon
} from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';

/**
 * Replace Grand Finale with one projectile per active orb, preserving each orb's
 * element and consuming the captured set atomically.
 *
 * Returning true tells the scheduler this cast's packets were authored here, so
 * the skill's declarative effects are skipped.
 */
export function scheduleGrandFinaleProfile(context: ElementalistCastContext, skill: Skill): boolean {
  if (skill.id !== ID.GRAND_FINALE) return false;
  const state = professionCoreState(context);
  const active = ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= context.start;
  });
  const conditions: Readonly<Record<ElementalistAttunement, readonly [string, number, number]>> = {
    Fire: ['Burning', 2, 5],
    Water: ['Vulnerability', 6, 10],
    Air: ['Weakness', 1, 5],
    Earth: ['Bleeding', 4, 5]
  };
  const at = context.effectiveEnd + balanceProfileValueFromContext(context, PROFILE.grandFinale, 'initialDelay', 0.68);
  for (let index = 0; index < active.length; index += 1) {
    const element = active[index];
    const strike = balanceProfileEffectFromContext(context, PROFILE.grandFinale, 'strike', 0, element);
    emitSkillDamage(context, {
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      coefficient: Number(strike?.coefficient ?? 1.4),
      skillWeapon: 'Hammer',
      comboFinishers: [
        {
          ownerId: 'elementalist',
          finisherType: 'Projectile',
          ambiguousFieldSelection: 'oldest'
        }
      ],
      hitIndex: index + 1,
      totalHits: active.length
    });
    const [condition, stacks, duration] = conditions[element];
    emitProfiledCondition(context, at, PROFILE.grandFinale, element, condition, stacks, duration, skill.name, skill.id);
  }

  return true;
}

/** Orb elements still live at `at`; shared by availability gating and the Weaver orb handler. */
export function activeHammerOrbElements(state: ElementalistCoreState, at: number): ElementalistAttunement[] {
  return ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= at;
  });
}

/** Core compatibility rule for spending an orb: only one matching the current primary attunement counts. */
export function hammerOrbMatchesAttunement(
  _context: ElementalistPrecastContext,
  state: ElementalistCoreState,
  element: ElementalistAttunement
): boolean {
  return element === state.primaryAttunement;
}

/**
 * Creating an orb refreshes all active orb windows; Grand Finale consumes the
 * stored orbs while leaving their visible buffs alive for the final packet.
 *
 * Cast-completion owner of the orb timers and of the buff events that mirror
 * them on the log timeline.
 */
export function applyHammerState(context: ElementalistCastContext, skill: Skill): void {
  if (skillWeapon(skill) !== 'Hammer') return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const single = HAMMER_ORB_SKILLS[Number(skill.id)];
  if (single) {
    const orbDuration = balanceProfileValueFromContext(context, PROFILE.hammerOrbs, 'durationMultiplier', 15);
    const previouslyActive = new Set(activeHammerOrbElements(state, at));
    // Refresh every live orb's window and stretch the buff event already on the timeline.
    for (const [element, expiresAt] of Object.entries(state.hammerOrbs)) {
      if (expiresAt != null && expiresAt >= at) {
        state.hammerOrbs[element as ElementalistAttunement] = at + orbDuration;
        for (const event of activeBuffEvents(context, `hammer ${element} orb`, at)) {
          context.replaceEvent(event, {
            duration: at + orbDuration - event.at
          });
        }
      }
    }

    for (const element of [single]) {
      state.hammerOrbs[element] = at + orbDuration;
      state.hammerOrbGrantedBy[element] = skill.name;
      state.hammerOrbActivationIds[element] = context.reservationId;
      state.hammerOrbBuffUntil[element] = at + orbDuration;
      // Only a newly created orb emits a buff; a refresh extended the existing one above.
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
    return;
  }

  // Grand Finale clears the stored orbs and trims their buffs to just past the
  // cast instead of ending them instantly, so the finisher still reads as covered.
  if (skill.id !== ID.GRAND_FINALE) return;
  const active = ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= context.start;
  });
  for (const element of active) {
    state.hammerOrbBuffUntil[element] = at + 1;
    for (const event of activeBuffEvents(context, `hammer ${element} orb`, at)) {
      context.replaceEvent(event, { duration: at + 1 - event.at });
    }

    state.hammerOrbs[element] = null;
    state.hammerOrbGrantedBy[element] = null;
    state.hammerOrbActivationIds[element] = null;
  }
}
