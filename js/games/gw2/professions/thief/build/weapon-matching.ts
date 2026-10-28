import { WEAPON } from '#gw2/platform/constants.js';
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';
import type { ThiefPlanningState, ThiefSkill, ThiefWeaponMatcherContext } from '#gw2/professions/thief/types.js';

/**
 * A palette that supplies its projected profession state shows only the rifle-stance and spear-chain variant occupying
 * each tile outside the full weapon-bar preview. Without one (live casts, build validation) every variant matches its
 * hands, and live availability enforces stance and chain stage with its specific reason.
 */
function matchesThiefVariant(skill: ThiefSkill, context: ThiefWeaponMatcherContext): boolean {
  if (!context.professionState) return true;

  const professionState = context.professionState as Partial<ThiefPlanningState>;

  if (
    skill.weapon === WEAPON.RIFLE &&
    !skill.stealthAttack &&
    Boolean(skill.kneelSkill) !== Boolean(professionState[STATE.KNEELING])
  )
    return false;

  const spearChainStage = spearChainStageForSkill(skill.id);
  return (
    spearChainStage == null ||
    Boolean(context.weaponBarPreview) ||
    (professionState[STATE.SPEAR_CHAIN_STAGE] || 0) === spearChainStage
  );
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

  // Temporary bars without hand requirements must not satisfy equipped weapon slots.
  if (!skill.weapon && skill.requiredMainHand == null && skill.requiredOffHand == null) return false;

  // Profession gates select the variant; shared equipment rules select the hands.
  return matchesThiefVariant(skill, context) && defaultWeaponSkillMatchesSet(skill, pair, context);
}
