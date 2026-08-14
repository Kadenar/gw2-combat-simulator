import type { Skill } from "../engine/types.js";
import type {
  Gw2WeaponMatcherContext,
  Gw2WeaponSkillMatcher,
} from "./types.js";

function slotNumber(skill: Skill): number {
  return Number(String(skill?.slot || "").match(/(\d+)$/)?.[1] || 0);
}

/**
 * Default weapon-set matcher. Exact requirements are data, so professions can
 * declare dual-wield and empty-offhand bars without shared profession checks.
 */
export function defaultWeaponSkillMatchesSet(
  skill: Skill,
  [mainHand = "", offHand = ""]: readonly (string | undefined)[] = [],
  context: Gw2WeaponMatcherContext = {},
): boolean {
  if (!skill) return true;
  const requiredMain = skill.requiredMainHand ?? skill.weaponSet?.mainHand;
  const requiredOff = skill.requiredOffHand ?? skill.weaponSet?.offHand;
  if (requiredMain != null || requiredOff != null) {
    return (
      (requiredMain == null || String(requiredMain) === String(mainHand)) &&
      (requiredOff == null ||
        (requiredOff === false
          ? !offHand
          : String(requiredOff) === String(offHand)))
    );
  }
  if (skill.type !== "Weapon" || !skill.weapon) return true;
  if (skill.requiresEmptyOffhand && offHand) return false;
  const wielding =
    context.weaponData?.[mainHand]?.wielding ||
    context.catalog?.weaponHands?.get?.(mainHand);
  if (wielding === "2h") return skill.weapon === mainHand;
  const slot = slotNumber(skill);
  return slot <= 3 ? skill.weapon === mainHand : skill.weapon === offHand;
}

export function weaponSkillMatchesSet(
  matcher: Gw2WeaponSkillMatcher | null | undefined,
  skill: Skill,
  weaponSet: readonly (string | undefined)[],
  context: Gw2WeaponMatcherContext = {},
): boolean {
  return (matcher || defaultWeaponSkillMatchesSet)(skill, weaponSet, context);
}
