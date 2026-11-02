// Skill rules support damage, duration, and critical targets; effect rules stay with their matching packet type.
import type { ConditionEffect, StrikeEffect } from '#gw2/platform/effects/types.js';
import type { SkillModifier } from '#gw2/platform/skills/modifiers.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export function checkSkillModifiers(): void {
  const duration = { id: 'duration', target: 'conditionBaseDuration', operation: 'multiply', factor: 1.5 } as const;
  const damage = { id: 'damage', target: 'strikeDamage', operation: 'multiply', factor: 1.5 } as const;
  const skill = { id: 1, name: 'Test', modifiers: [duration, damage] } satisfies Skill;
  const condition = {
    type: 'condition',
    condition: 'Bleeding',
    stacks: 1,
    duration: 2,
    modifiers: [duration]
  } satisfies ConditionEffect;
  const strike = { type: 'strike', coefficient: 1, modifiers: [damage] } satisfies StrikeEffect;
  const additive = {
    id: 'add',
    target: 'conditionBaseDuration',
    operation: 'add',
    amount: 0.5
  } satisfies SkillModifier;
  const conditionDamage = {
    id: 'condition-damage',
    target: 'conditionDamage',
    operation: 'damage-additive',
    amount: 0.2
  } as const satisfies SkillModifier;
  const conditionDuration = {
    id: 'condition-duration',
    target: 'conditionDuration',
    operation: 'multiply',
    factor: 1.2
  } as const satisfies SkillModifier;
  const criticalChance = {
    id: 'critical-chance',
    target: 'criticalChance',
    operation: 'add',
    amount: 0.2
  } as const satisfies SkillModifier;
  const conditionRules = { ...condition, modifiers: [conditionDamage, conditionDuration] } satisfies ConditionEffect;
  const criticalRules = { ...strike, modifiers: [criticalChance] } satisfies StrikeEffect;
  // @ts-expect-error Critical chance is a strike target.
  const conditionCrit: ConditionEffect = { ...condition, modifiers: [criticalChance] };
  // @ts-expect-error Condition damage cannot be attached to a strike effect.
  const strikeCondition: StrikeEffect = { ...strike, modifiers: [conditionDamage] };
  // @ts-expect-error Ordinary condition duration cannot be attached to a strike effect.
  const strikeDuration: StrikeEffect = { ...strike, modifiers: [conditionDuration] };
  // @ts-expect-error Condition damage uses damage-additive, not scalar addition.
  const conditionAddition: SkillModifier = { ...conditionDamage, operation: 'add' };
  // @ts-expect-error Critical chance cannot use a damage bucket.
  const criticalBucket: SkillModifier = { ...criticalChance, operation: 'damage-additive' };
  // @ts-expect-error Ordinary condition duration cannot use a damage bucket.
  const durationBucket: SkillModifier = { ...conditionDuration, operation: 'damage-additive' };
  void [
    conditionRules,
    criticalRules,
    conditionCrit,
    strikeCondition,
    strikeDuration,
    conditionAddition,
    criticalBucket,
    durationBucket
  ];
  const professionRule = { ...damage, scope: 'profession' } as const satisfies SkillModifier;
  const explicitSkillRule = { ...damage, scope: 'skill' } as const satisfies SkillModifier;
  const buffSkill = { ...skill, modifiers: [professionRule] } satisfies Skill;
  const scopedStrike = { ...strike, modifiers: [explicitSkillRule] } satisfies StrikeEffect;
  // @ts-expect-error Effect modifiers cannot opt into profession scope.
  const globalStrike: StrikeEffect = { ...strike, modifiers: [professionRule] };
  // @ts-expect-error Condition effects cannot opt into profession scope either.
  const globalCondition: ConditionEffect = { ...condition, modifiers: [{ ...duration, scope: 'profession' }] };
  // @ts-expect-error Only the two authored scopes are supported.
  const unknownScope: SkillModifier = { ...damage, scope: 'global' };
  void [buffSkill, scopedStrike, globalStrike, globalCondition, unknownScope];
  void [skill, condition, strike, additive];
  // @ts-expect-error Duration rules cannot be attached to strikes.
  const invalidStrike: StrikeEffect = { ...strike, modifiers: [duration] };
  // @ts-expect-error Strike bonuses cannot be attached to condition effects.
  const invalidCondition: ConditionEffect = { ...condition, modifiers: [damage] };
  // @ts-expect-error Damage buckets do not apply to base duration.
  const invalidOperation: SkillModifier = { ...duration, operation: 'damage-additive' };
  void [invalidStrike, invalidCondition, invalidOperation];
}
