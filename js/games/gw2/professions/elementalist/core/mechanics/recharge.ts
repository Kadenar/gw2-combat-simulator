import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { elementalForGlyphId } from '#gw2/professions/elementalist/core/mechanics/elementals/queries.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Handles held cooldowns and skill-owned scaling without spending next-cast empowerments.
 * Compiled trait declarations supply persistent discounts for ordinary recharge queries.
 */
export function elementalistRechargeWork(
  _context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill,
  duration: number,
  releasing = false
): number {
  // The summon owns this recharge: `mechanics/elementals/runtime.ts` starts the glyph cooldown
  // when the elemental expires, so the cast itself must not start one.
  if (elementalForGlyphId(skill.id)) return 0;

  // Rock Barrier holds its recharge until the stored barrier is released; the
  // release handler re-requests the duration with that flag set.
  if (skill.id === ID.ROCK_BARRIER && !releasing) {
    return 0;
  }

  // Everything below is weapon-slot policy; other skill types keep their catalog recharge.
  if (skill.type !== 'Weapon') {
    return duration;
  }

  // Skill-owned scaling stays here; the compiled trait declarations own training multipliers.
  return skill.rechargeMultiplier === undefined ? duration : duration * skillNumber(skill, 'rechargeMultiplier');
}
