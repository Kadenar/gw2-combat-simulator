import { professionCoreState } from '../../../platform/engine/profession.js';
/**
 * @fileoverview Tracks Guardian weapon autoattack chains, temporary flip
 * availability, normal weapon-bar gating, and weapon-set swaps.
 */

import { hasTrait } from '../../../platform/gw2/trait-state.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '../data/ids.js';
import { emitGuardianEvent } from './events.js';
import type { GuardianCastContext, GuardianSkill } from '../types.js';

/**
 * Guardian weapon-slot bookkeeping: autoattack-chain progression, weapon swap,
 * and flip-skill (over/under) availability windows.
 *
 * The three pieces of per-weapon state all live on `professionCoreState(context)`:
 * - `autoattackChains` — map of chain-root skill id → the id of the next step
 *   the slot-1 autoattack should fire. Absent means "start from the root".
 * - `availableFlips` — map of flip-skill id → the sim time the flip stays
 *   castable until (armed by casting its parent, e.g. Zealot's Flame → Fire).
 * - `activeWeaponSet` — 1 or 2, toggled by weapon swap.
 *
 * Chain positions are indexed once by the canonical catalog so lookups during
 * validation/afterCast are O(1).
 */
/**
 * afterCast hook (order 10): advances the stored per-weapon state once a cast
 * resolves.
 *
 * - Interrupted casts (effective end short of the full cast) leave everything
 *   untouched — the chain does not step and flips are not armed.
 * - A chain skill advances `autoattackChains[root]` to the next step, or clears
 *   the entry when the chain loops back to its root.
 * - Any other completed weapon skill resets all pending chains.
 * - When a skill's flip differs from its chain successor and the flip points
 *   back at it, arm that flip: Zealot's Flame gets a fixed 3s window, otherwise
 *   the flip stays castable for the skill's cooldown/recharge (min 1, default 5).
 * - Casting a flip skill consumes its `availableFlips` entry.
 *
 * @param {GuardianCastContext} context Scheduler after-cast context.
 * @param {GuardianSkill} skill Completed skill.
 * @returns {void}
 */
export function updateWeaponCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const chain = typeof skill.id === 'number' ? context.catalog.autoattackChainPositions.get(skill.id) : undefined;
  if (chain) {
    if (chain.next == null) {
      delete professionCoreState(context).autoattackChains[chain.root];
    } else {
      professionCoreState(context).autoattackChains[chain.root] = chain.next;
    }
  } else if (skill.type === 'Weapon' && skill.id !== GUARDIAN_SKILL_IDS.ZEALOTS_FLAME) {
    professionCoreState(context).autoattackChains = {};
  }

  if (skill.flipSkillId != null && skill.flipSkillId !== skill.nextChainId) {
    const flip = context.catalog.skillsById.get(skill.flipSkillId);
    if (flip?.flipParentId === skill.id) {
      const duration =
        skill.id === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME
          ? hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)
            ? 4.5
            : 3
          : Math.max(1, Number(skill.cooldown || skill.recharge || 5));
      professionCoreState(context).availableFlips[flip.id] = context.effectiveEnd + duration;
    }
  }
  if (skill.flipParentId != null) {
    delete professionCoreState(context).availableFlips[skill.id];
  }
}

/**
 * "guardian.weapon-swap" skill handler: toggles the active weapon set (1↔2),
 * drops any pending autoattack chains, and emits a `weapon_set` event.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Synthetic weapon-swap skill.
 * @returns {boolean} Always true because this replacing handler owns the cast.
 */
function swapWeapons(context: GuardianCastContext, skill: GuardianSkill): boolean {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  professionCoreState(context).autoattackChains = {};
  emitGuardianEvent(context, skill, 'weapon_set', { weaponSet });
  return true;
}

/**
 * Raw weapon-state callbacks consumed by the central handler registry.
 */
export const guardianWeaponSkillHandlers = Object.freeze({
  'guardian.weapon-swap': swapWeapons
});
