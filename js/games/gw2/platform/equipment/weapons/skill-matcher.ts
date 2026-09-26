import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2WeaponMatcherContext, Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Validate the current equipped set while retaining unrestricted builds with no configured weapons. */
export function isGw2WeaponSkillEquipped(
  context: Gw2WeaponMatcherContext & { readonly config: Gw2Config; readonly weaponSet: number },
  skill: Skill,
  matcher?: Gw2WeaponSkillMatcher
): boolean {
  const hasExplicitRequirement =
    skill.requiredMainHand != null ||
    skill.requiredOffHand != null ||
    skill.weaponSet?.mainHand != null ||
    skill.weaponSet?.offHand != null;
  if (!hasExplicitRequirement && (skill.type !== 'Weapon' || !skill.weapon)) return true;
  const configured = gw2ConfiguredWeaponSet(context.config, context.weaponSet === 2 ? 2 : 1);
  return configured.every((value) => !value) || weaponSkillMatchesSet(matcher, skill, configured, context);
}

function slotNumber(skill: Skill): number {
  return Number(String(skill?.slot || '').match(/(\d+)$/)?.[1] || 0);
}

/**
 * Default weapon-set matcher. Exact requirements are data, so professions can
 * declare dual-wield and empty-offhand bars without shared profession checks.
 */
export function defaultWeaponSkillMatchesSet(
  skill: Skill,
  [mainHand = '', offHand = '']: readonly (string | undefined)[] = [],
  context: Gw2WeaponMatcherContext = {}
): boolean {
  if (!skill) return true;
  const requiredMain = skill.requiredMainHand ?? skill.weaponSet?.mainHand;
  const requiredOff = skill.requiredOffHand ?? skill.weaponSet?.offHand;
  if (requiredMain != null || requiredOff != null) {
    return (
      (requiredMain == null || String(requiredMain) === String(mainHand)) &&
      (requiredOff == null || (requiredOff === false ? !offHand : String(requiredOff) === String(offHand)))
    );
  }

  if (skill.type !== 'Weapon' || !skill.weapon) return true;
  if (skill.requiresEmptyOffhand && offHand) return false;
  const wielding = context.weaponData?.[mainHand]?.wielding || context.catalog?.weaponHands?.get?.(mainHand);
  if (wielding === '2h') return skill.weapon === mainHand;
  const slot = slotNumber(skill);
  return slot <= 3 ? skill.weapon === mainHand : skill.weapon === offHand;
}

/** Evaluates a weapon skill against a set using the supplied matcher or the default policy. */
export function weaponSkillMatchesSet(
  matcher: Gw2WeaponSkillMatcher | null | undefined,
  skill: Skill,
  weaponSet: readonly (string | undefined)[],
  context: Gw2WeaponMatcherContext = {}
): boolean {
  return (matcher || defaultWeaponSkillMatchesSet)(skill, weaponSet, context);
}
