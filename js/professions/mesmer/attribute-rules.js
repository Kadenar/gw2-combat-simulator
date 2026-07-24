function traitIds(context) {
  return new Set(
    context.config?.selectedTraitIds
    || context.selectedTraitIds
    || [],
  );
}

export const MESMER_TRAIT_RULES = Object.freeze({
  // Rule functions are keyed by stable API trait IDs. Name-based compatibility
  // remains confined to the legacy Mesmer simulator.
});

export function applyMesmerAttributes(context, attributes) {
  let result = { ...attributes };
  for (const id of traitIds(context)) {
    const rule = MESMER_TRAIT_RULES[id];
    if (rule?.modifyAttributes) result = rule.modifyAttributes(context, result);
  }
  return result;
}

export function applyMesmerScalar(ruleName) {
  return (context, initialValue) => {
    let value = initialValue;
    for (const id of traitIds(context)) {
      const rule = MESMER_TRAIT_RULES[id];
      if (rule?.[ruleName]) value = rule[ruleName](context, value);
    }
    return value;
  };
}

export const mesmerAttributeRules = Object.freeze({
  modifyAttributes: applyMesmerAttributes,
  modifyCriticalChance: applyMesmerScalar("modifyCriticalChance"),
  modifyCriticalDamage: applyMesmerScalar("modifyCriticalDamage"),
  modifyStrikeDamage: applyMesmerScalar("modifyStrikeDamage"),
  modifyConditionDamage: applyMesmerScalar("modifyConditionDamage"),
});
