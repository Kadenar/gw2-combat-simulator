import { WEAPON } from '#gw2/platform/constants.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { skillNumberFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { elementalForGlyphId } from '#gw2/professions/elementalist/core/mechanics/elementals/queries.js';
import { reservePistolRecharge } from '#gw2/professions/elementalist/core/skills/weapons/pistol.js';
import { aeromancersTrainingRecharge } from '#gw2/professions/elementalist/core/traits/air/index.js';
import { geomancersTrainingRecharge } from '#gw2/professions/elementalist/core/traits/earth/index.js';
import { pyromancersTrainingRecharge } from '#gw2/professions/elementalist/core/traits/fire/index.js';
import { aquamancersTrainingRecharge } from '#gw2/professions/elementalist/core/traits/water/index.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/**
 * Calculates persistent attunement and skill recharge rules without spending
 * next-cast empowerments, including when queried for bulk cooldown reductions.
 */
export function elementalistRechargeWork(
  context: MechanicQueriesOf<ElementalistRuntime>,
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

  // A skill that declares its own recharge factor applies it before trait rules, from the selected (patched) skill.
  let adjusted =
    skill.rechargeMultiplier === undefined ? duration : duration * skillNumber(skill, 'rechargeMultiplier');
  adjusted = pyromancersTrainingRecharge(context, skill, adjusted);
  adjusted = aeromancersTrainingRecharge(context, skill, adjusted);
  adjusted = geomancersTrainingRecharge(context, skill, adjusted);
  return aquamancersTrainingRecharge(context, skill, adjusted);
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
