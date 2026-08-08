import { professionCoreState } from "../../../platform/engine/profession.js";
import { replaceSkill } from "../../../platform/gw2/native-profession.js";
import type { RangerCastContext, RangerSkill } from "../types.js";

function swapRangerWeapons(
  context: RangerCastContext,
  skill: RangerSkill,
): boolean {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  professionCoreState(context).autoattackChains = {};
  context.emit({
    type: "weapon_set",
    at: context.effectiveEnd,
    source: "ranger",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet,
  });
  return true;
}

export const rangerCoreSkillHandlers = Object.freeze({
  "ranger.weapon-swap": replaceSkill({
    beforeEffects: swapRangerWeapons,
  }),
});
