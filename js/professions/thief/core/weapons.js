import { spearChainStageForSkill } from "./conditions.js";

export function thiefWeaponSkillMatchesSet(skill, pair, context = {}) {
  const professionState =
    context.professionState
    || context.state?.profession
    || {};
  if (
    skill.stealthAttack
    && Boolean(skill.malicious)
      !== Boolean(professionState.usesMaliciousStealthAttacks)
  ) {
    return false;
  }
  if (
    skill.weapon === "Rifle"
    && !skill.stealthAttack
    && Boolean(skill.kneelSkill) !== Boolean(professionState.kneeling)
  ) return false;
  const spearChainStage = spearChainStageForSkill(skill.id);
  if (
    spearChainStage != null
    && !context.weaponBarPreview
    && Number(professionState.spearChainStage || 0) !== spearChainStage
  ) return false;
  if (
    skill.requiredMainHand != null
    || skill.requiredOffHand != null
    || skill.requiresEmptyOffhand
  ) {
    const [mainHand = "", offHand = ""] = pair;
    return (
      (skill.requiredMainHand == null || skill.requiredMainHand === mainHand)
      && (
        skill.requiredOffHand == null
        || (
          skill.requiredOffHand === false
            ? !offHand
            : skill.requiredOffHand === offHand
        )
      )
    );
  }
  const wielding = context.weaponData?.[pair[0]]?.wielding
    || context.catalog?.weaponHands?.get(pair[0]);
  if (wielding === "2h") return skill.weapon === pair[0];
  const slot = Number(String(skill.slot || "").match(/(\d+)$/)?.[1] || 0);
  return slot <= 3 ? skill.weapon === pair[0] : skill.weapon === pair[1];
}
