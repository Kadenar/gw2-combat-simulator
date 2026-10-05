import type { SideEffectAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Skill, BalanceProfile } from '#gw2/platform/skills/types.js';

export type ResourceGrantAction = Extract<SideEffectAction, { type: 'resourceGrant' }> & { readonly id: string };

/** Stable identities expose authored resource rewards without depending on reaction or action ordering. */
export function resourceGrantActions(actions: readonly SideEffectAction[]): readonly ResourceGrantAction[] {
  return actions.filter(
    (action): action is ResourceGrantAction => action.type === 'resourceGrant' && typeof action.id === 'string'
  );
}

export function effectResourceGrants(effect: Pick<SkillEffect, 'reactions'>): readonly ResourceGrantAction[] {
  return resourceGrantActions(
    (effect.reactions ?? []).flatMap((rule) => (Array.isArray(rule.do) ? rule.do : [rule.do]))
  );
}

export function castResourceGrants(skill: Skill | BalanceProfile): readonly ResourceGrantAction[] {
  const rules = skill.sideEffects as Skill['sideEffects'];
  return resourceGrantActions((rules ?? []).map((rule) => rule.do));
}

/** Numeric parameters are the shared source for editable controls; formulas and nonnumeric choices stay owner-authored. */
export function resourceGrantNumericFields(action: ResourceGrantAction): Record<string, number> {
  if (typeof action.amount === 'number') return { amount: action.amount };
  if (!('parameters' in action.amount)) return {};
  const fields: Record<string, number> = {};
  const visit = (value: unknown, path: string): void => {
    if (typeof value === 'number') fields[path] = value;
    else if (value && typeof value === 'object' && !Array.isArray(value))
      for (const [key, child] of Object.entries(value)) visit(child, path ? `${path}.${key}` : key);
  };

  visit(action.amount.parameters, '');
  return fields;
}
