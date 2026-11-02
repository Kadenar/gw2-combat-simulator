// Intrinsic duration rules belong to skills or condition effects; damage rules remain strike-specific.
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
  void [skill, condition, strike, additive];
  // @ts-expect-error Duration rules cannot be attached to strikes.
  const invalidStrike: StrikeEffect = { ...strike, modifiers: [duration] };
  // @ts-expect-error Strike bonuses cannot be attached to condition effects.
  const invalidCondition: ConditionEffect = { ...condition, modifiers: [damage] };
  // @ts-expect-error Damage buckets do not apply to base duration.
  const invalidOperation: SkillModifier = { ...duration, operation: 'damage-additive' };
  void [invalidStrike, invalidCondition, invalidOperation];
}
