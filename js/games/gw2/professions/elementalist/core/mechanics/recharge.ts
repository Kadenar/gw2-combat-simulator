import { WEAPON } from '#gw2/platform/constants.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { skillNumberFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { elementalForGlyphId } from '#gw2/professions/elementalist/core/mechanics/elementals/queries.js';
import { reservePistolRecharge } from '#gw2/professions/elementalist/core/skills/weapons/pistol.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/**
 * Handles held cooldowns and skill-owned scaling without spending next-cast empowerments.
 * Compiled trait declarations supply persistent discounts for ordinary recharge queries.
 */
export function elementalistRechargeWork(
  _context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
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

/** Spends the eligible empowerment when a cast is accepted; its reservation retains the selected duration. */
export function reserveElementalistRecharge(context: ElementalistRuntime, skill: Skill, duration: number): number {
  if (skill.type !== 'Weapon' || String(skill.slot || '') === 'Weapon_1') return duration;

  const state = professionCoreState(context);

  if (state.spearNextRechargeReduction && skillWeapon(skill) === WEAPON.SPEAR) {
    state.spearNextRechargeReduction = false;
    return duration * skillNumberFromContext(context, ID.RIPPLE, 'nextSkillRechargeMultiplier');
  }

  return reservePistolRecharge(context, skill, duration);
}
