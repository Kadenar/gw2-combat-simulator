import { spearChainStageForSkill } from '#gw2/content/professions/thief/core/skills/spear-chain.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import type { ThiefSkill, ThiefState, ThiefWeaponMatcherContext } from '#gw2/content/professions/thief/types.js';

// Match weapon skills against hand requirements while projecting live rifle
// stance and spear-chain state outside the full weapon-bar preview.
export function thiefWeaponSkillMatchesSet(
  skill: ThiefSkill,
  pair: readonly (string | undefined)[] = [],
  context: ThiefWeaponMatcherContext = {}
): boolean {
  const professionState = flattenProfessionState(
    context.professionState || context.state?.profession || {}
  ) as unknown as Partial<ThiefState>;
  if (
    skill.weapon === 'Rifle' &&
    !skill.stealthAttack &&
    Boolean(skill.kneelSkill) !== Boolean(professionState.kneeling)
  )
    return false;
  const spearChainStage = spearChainStageForSkill(skill.id);
  if (
    spearChainStage != null &&
    !context.weaponBarPreview &&
    Number(professionState.spearChainStage || 0) !== spearChainStage
  )
    return false;
  if (skill.requiredMainHand != null || skill.requiredOffHand != null || skill.requiresEmptyOffhand) {
    const [mainHand = '', offHand = ''] = pair;
    return (
      (skill.requiredMainHand == null || skill.requiredMainHand === mainHand) &&
      (skill.requiredOffHand == null ||
        (skill.requiredOffHand === false ? !offHand : skill.requiredOffHand === offHand))
    );
  }

  const primary = pair[0] || '';
  const wielding = context.weaponData?.[primary]?.wielding || context.catalog?.weaponHands?.get(primary);
  if (wielding === '2h') return skill.weapon === pair[0];
  const slot = Number(String(skill.slot || '').match(/(\d+)$/)?.[1] || 0);
  return slot <= 3 ? skill.weapon === pair[0] : skill.weapon === pair[1];
}
