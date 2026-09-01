import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
/** @fileoverview Tracks Guardian temporary weapon-flip availability. */

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import type { GuardianCastContext, GuardianSkill } from '#gw2/content/professions/guardian/types.js';

/**
 * Arms or consumes Guardian flip skills after a completed cast. Shared GW2
 * hooks have already advanced or reset autoattack chains at this point.
 *
 * - Interrupted casts (effective end short of the full cast) leave everything
 *   untouched, so flips are not armed.
 * - When a skill's flip differs from its chain successor and the flip points
 *   back at it, arm that flip: Zealot's Flame gets a fixed 3s window, otherwise
 *   the flip stays castable for the skill's cooldown/recharge (min 1, default 5).
 * - Casting a flip skill consumes its `availableFlips` entry.
 */
export function updateWeaponCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  // Banish fully refreshes Mighty Blow only after Banish completes successfully.
  if (skill.id === GUARDIAN_SKILL_IDS.BANISH) context.state.cooldowns.delete(GUARDIAN_SKILL_IDS.MIGHTY_BLOW);

  if (skill.flipSkillId != null && skill.flipSkillId !== skill.nextChainId) {
    const flip = context.catalog.skillsById.get(skill.flipSkillId);
    if (flip?.flipParentId === skill.id) {
      const duration =
        skill.id === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME
          ? hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)
            ? 4.5
            : 3
          : skill.id === GUARDIAN_SKILL_IDS.SHIELD_OF_ABSORPTION
            ? 4
            : Math.max(1, Number(skill.cooldown || skill.recharge || 5));
      professionCoreState(context).availableFlips[flip.id] = context.effectiveEnd + duration;
    }
  }

  if (skill.flipParentId != null) {
    delete professionCoreState(context).availableFlips[skill.id];
  }
}
