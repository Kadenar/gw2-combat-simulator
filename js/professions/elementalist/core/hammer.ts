import { emitSkillBuff, emitSkillDamage } from '../../../platform/gw2/scheduler/skill-events.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import type { Skill } from '../../../platform/engine/types.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext as ElementalistCastContext
} from '../types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement, type ElementalistCoreState } from './state.js';
import { HAMMER_ORB_SKILLS } from './constants.js';
import { activeBuffEvents, emitProfiledCondition, profiledEffect, skillWeapon } from './mechanics.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE, elementalistBalanceValue } from './profiles.js';

// Replace Grand Finale with one projectile per active orb, preserving each orb's
// element and consuming the captured set atomically.
export function scheduleGrandFinaleProfile(context: ElementalistLifecycleContext, skill: Skill): boolean {
  if (skill.name !== 'Grand Finale') return false;
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
  const at = context.effectiveEnd + elementalistBalanceValue(context, PROFILE.grandFinale, 'initialDelay', 0.68);
  for (let index = 0; index < active.length; index += 1) {
    const element = active[index];
    const strike = profiledEffect(context, PROFILE.grandFinale, 'strike', element);
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

export function activeHammerOrbElements(state: ElementalistCoreState, at: number): ElementalistAttunement[] {
  return ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= at;
  });
}

export function hammerOrbMatchesAttunement(
  _context: ElementalistCastContext,
  state: ElementalistCoreState,
  element: ElementalistAttunement
): boolean {
  return element === state.primaryAttunement;
}

// Creating an orb refreshes all active orb windows; Grand Finale consumes the
// stored orbs while leaving their visible buffs alive for the final packet.
export function applyHammerState(context: ElementalistLifecycleContext, skill: Skill): void {
  if (skillWeapon(skill) !== 'Hammer') return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const single = HAMMER_ORB_SKILLS[Number(skill.id)];

  if (single) {
    const orbDuration = elementalistBalanceValue(context, PROFILE.hammerOrbs, 'durationMultiplier', 15);
    const previouslyActive = new Set(activeHammerOrbElements(state, at));
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

  if (skill.name !== 'Grand Finale') return;
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
