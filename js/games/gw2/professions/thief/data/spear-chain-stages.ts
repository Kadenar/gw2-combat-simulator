import { WEAPON } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Both spear slots use their one-based weapon-bar step to select the same zero-based combat stage. */
export function spearChainStageForSkill(skill: Skill): number | null {
  return skill.weapon === WEAPON.SPEAR && skill.weaponBarChainStep != null ? skill.weaponBarChainStep - 1 : null;
}
