/**
 * @fileoverview Tracks Guardian weapon autoattack chains, temporary flip
 * availability, normal weapon-bar gating, and weapon-set swaps.
 */

import { GUARDIAN_SKILL_IDS } from "../../data/ids.js";
import { emitGuardianEvent } from "../events.js";

/**
 * Guardian weapon-slot bookkeeping: autoattack-chain progression, weapon swap,
 * and flip-skill (over/under) availability windows.
 *
 * The three pieces of per-weapon state all live on `context.state.profession`:
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
 * validateCast hook (order 50): decides whether a weapon skill may cast now.
 * Combined with `!== false`, so `undefined` = no opinion (allow) and only an
 * explicit `false` blocks the cast.
 *
 * - Exit Radiant Forge is always allowed — the tome/forge guard below would
 *   otherwise trap the player inside the forge.
 * - Any other weapon skill is blocked while a tome is open or Radiant Forge is
 *   active, since those replace the normal weapon bar.
 * - A flip skill (has `flipParentId`) is castable only while its armed window
 *   in `availableFlips` is still ahead of the cast start.
 * - A chain skill is castable only when it is the currently-expected step of
 *   its chain (the root when nothing is pending). Non-chain, non-flip weapon
 *   skills fall through to `undefined` (allowed).
 *
 * @param {object} context Cast-validation context.
 * @param {object} skill Candidate skill.
 * @returns {boolean|undefined} Whether a relevant weapon skill is castable.
 */
export function validateWeaponState(context, skill) {
  if (skill.id === GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE) return;
  if (
    skill.type === "Weapon" &&
    (context.state.profession.activeTome ||
      context.state.profession.radiantForge)
  )
    return false;
  if (skill.flipParentId != null) {
    return (
      Number(context.state.profession.availableFlips[skill.id] || 0) >
      context.start + context.epsilon
    );
  }
  const chain = context.catalog.autoattackChainPositions.get(skill.id);
  if (!chain) return;
  const expected =
    context.state.profession.autoattackChains[chain.root] || chain.root;
  return expected === skill.id;
}

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
 * @param {object} context Scheduler after-cast context.
 * @param {object} skill Completed skill.
 * @returns {void}
 */
export function updateWeaponCastState(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const chain = context.catalog.autoattackChainPositions.get(skill.id);
  if (chain) {
    if (chain.next == null) {
      delete context.state.profession.autoattackChains[chain.root];
    } else {
      context.state.profession.autoattackChains[chain.root] = chain.next;
    }
  } else if (skill.type === "Weapon") {
    context.state.profession.autoattackChains = {};
  }

  if (skill.flipSkillId != null && skill.flipSkillId !== skill.nextChainId) {
    const flip = context.catalog.skillsById.get(skill.flipSkillId);
    if (flip?.flipParentId === skill.id) {
      const duration =
        skill.id === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME
          ? 3
          : Math.max(1, Number(skill.cooldown || skill.recharge || 5));
      context.state.profession.availableFlips[flip.id] =
        context.effectiveEnd + duration;
    }
  }
  if (skill.flipParentId != null) {
    delete context.state.profession.availableFlips[skill.id];
  }
}

/**
 * "guardian.weapon-swap" skill handler: toggles the active weapon set (1↔2),
 * drops any pending autoattack chains, and emits a `weapon_set` event.
 *
 * @param {object} context Skill-handler context.
 * @param {object} skill Synthetic weapon-swap skill.
 * @returns {boolean} Always true because this replacing handler owns the cast.
 */
function swapWeapons(context, skill) {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  context.state.profession.autoattackChains = {};
  emitGuardianEvent(context, skill, "weapon_set", { weaponSet });
  return true;
}

/**
 * Raw weapon-state callbacks consumed by the central handler registry.
 */
export const guardianWeaponSkillHandlers = Object.freeze({
  "guardian.weapon-swap": swapWeapons,
});
