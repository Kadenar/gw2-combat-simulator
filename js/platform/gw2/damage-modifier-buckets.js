function additiveSigil(context, damageType) {
  const sigils = context.timeline?.activeSigilSetAt(context.time) || {};
  const factorKey = damageType === "condition" ? "condition" : "strike";
  const bonusKey = damageType === "condition"
    ? "conditionAdd"
    : "strikeAdd";
  const factor = Math.max(
    Number.EPSILON,
    Number(sigils[factorKey] || 1),
  );
  const configuredBonus = Number(sigils[bonusKey]);
  return {
    factor,
    bonus: Number.isFinite(configuredBonus)
      ? configuredBonus
      : factor - 1,
  };
}

/**
 * Rebuilds GW2's additive outgoing-damage bucket after the active sigil
 * factor has already been included in the platform multiplier.
 */
export function applyAdditiveDamageBucket(
  context,
  multiplier,
  {
    damageType = "strike",
    bonus = 0,
    includeSigil = true,
  } = {},
) {
  const sigil = additiveSigil(context, damageType);
  return (
    Number(multiplier || 1)
    / sigil.factor
    * (
      1
      + (includeSigil ? sigil.bonus : 0)
      + Number(bonus || 0)
    )
  );
}
