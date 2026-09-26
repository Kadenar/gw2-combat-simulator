import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';
import type { ThiefSkill, ThiefState, ThiefWeaponMatcherContext } from '#gw2/professions/thief/types.js';

/**
 * A palette that supplies its projected profession state shows only the rifle-stance and spear-chain variant occupying
 * each tile outside the full weapon-bar preview. Without one (live casts, build validation) every variant matches its
 * hands, and live availability enforces stance and chain stage with its specific reason.
 */
function matchesThiefVariant(skill: ThiefSkill, context: ThiefWeaponMatcherContext): boolean {
  if (!context.professionState) return true;
  const professionState = flattenProfessionState(context.professionState) as unknown as Partial<ThiefState>;
  if (
    skill.weapon === 'Rifle' &&
    !skill.stealthAttack &&
    Boolean(skill.kneelSkill) !== Boolean(professionState.kneeling)
  )
    return false;
  const spearChainStage = spearChainStageForSkill(skill.id);
  return (
    spearChainStage == null ||
    Boolean(context.weaponBarPreview) ||
    Number(professionState.spearChainStage || 0) === spearChainStage
  );
}

/** Matches weapon skills against hand requirements and the palette's projected variant. */
function matchesThiefWeaponSet(
  skill: ThiefSkill,
  pair: readonly (string | undefined)[],
  context: ThiefWeaponMatcherContext
): boolean {
  if (!matchesThiefVariant(skill, context)) return false;
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

/**
 * Selects the active specialization's weapon matching policy for build validation and live palettes. Deadeye replaces
 * every base stealth attack with its malicious counterpart; every other runtime excludes the malicious replacements.
 */
export function thiefWeaponSkillMatchesSet(
  skill: ThiefSkill,
  pair: readonly (string | undefined)[] = [],
  context: ThiefWeaponMatcherContext = {}
): boolean {
  const specialization = context.specialization || context.config?.specialization || 'Core';
  if (skill.stealthAttack && Boolean(skill.malicious) !== (specialization === 'Deadeye')) return false;
  return matchesThiefWeaponSet(skill, pair, context);
}
