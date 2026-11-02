import { createModifierHooks, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { NativeModuleCatalogData } from '#gw2/platform/profession-definition/module-types.js';

export type SkillModifierScope = 'skill' | 'profession';

/** Skill-owned rules default to their owner's packets; duration additions adjust the multiplier, not seconds. */
export type SkillModifier = Pick<
  Gw2ModifierRule,
  'id' | 'label' | 'amount' | 'factor' | 'parameters' | 'when' | 'order'
> & {
  /** Profession scope uses only the authored predicate; the declaring skill remains the source. */
  readonly scope?: SkillModifierScope;
} & (
    | { readonly target: 'strikeDamage'; readonly operation: 'multiply' | 'damage-additive' }
    | { readonly target: 'conditionDamage'; readonly operation: 'multiply' | 'damage-additive' }
    | { readonly target: 'criticalChance'; readonly operation: 'multiply' | 'add' }
    | { readonly target: 'criticalDamage'; readonly operation: 'multiply' | 'add' }
    | { readonly target: 'conditionDuration'; readonly operation: 'multiply' | 'add' }
    | { readonly target: 'conditionBaseDuration'; readonly operation: 'multiply' | 'add' }
  );

/** Effect declarations cannot grant bonuses beyond their own skill and packet identity. */
export type SkillEffectModifier = SkillModifier & { readonly scope?: 'skill' };

const FIELDS = new Set([
  'id',
  'label',
  'target',
  'operation',
  'amount',
  'factor',
  'parameters',
  'when',
  'order',
  'scope'
]);

/** Validate authoring at the catalog boundary, retaining only immutable declarations and existing formula semantics. */
export function normalizeSkillModifiers(value: unknown, label: string): readonly SkillModifier[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} modifiers must be an array.`);

  if (!value.length) return Object.freeze([]);

  for (const rule of value) {
    if (
      !rule ||
      typeof rule !== 'object' ||
      Array.isArray(rule) ||
      Object.keys(rule).some((field) => !FIELDS.has(field)) ||
      ![
        'strikeDamage',
        'conditionDamage',
        'criticalChance',
        'criticalDamage',
        'conditionDuration',
        'conditionBaseDuration'
      ].includes(rule.target) ||
      (rule.scope !== undefined && !['skill', 'profession'].includes(rule.scope))
    ) {
      throw new TypeError(`${label} has an invalid skill modifier.`);
    }
  }

  // Shared validation owns scalar operations and permits zero only for base-duration suppression.
  // Scope belongs to skill registration, not the shared modifier compiler's schema.
  createModifierHooks({ rules: value.map(({ scope: _scope, ...rule }) => rule) });
  return Object.freeze(
    value.map((rule) =>
      Object.freeze({
        ...rule,
        ...(rule.parameters ? { parameters: Object.freeze({ ...rule.parameters }) } : {})
      })
    )
  );
}

/** Effect rules may affect only their packet type; condition bonuses cannot leak through a strike's identity. */
export function normalizeSkillEffectModifiers(
  value: unknown,
  label: string,
  effectType: string
): readonly SkillModifier[] {
  if (effectType !== 'strike' && effectType !== 'condition')
    throw new TypeError(`${label} modifiers require a strike or condition effect.`);

  const rules = normalizeSkillModifiers(value, label);
  for (const rule of rules) {
    if (rule.scope === 'profession')
      throw new TypeError(`${label} modifier ${rule.id} cannot use profession scope on an effect.`);

    // Damage and duration rules follow condition packets; critical rules follow strikes.
    if (
      ['conditionDamage', 'conditionDuration', 'conditionBaseDuration'].includes(rule.target) !==
      (effectType === 'condition')
    )
      throw new TypeError(`${label} modifier ${rule.id} target ${rule.target} is invalid for a ${effectType} effect.`);
  }

  return rules;
}

/** Register skill declarations once with module rules so canonical compilation and balance authoring share them. */
export function nativeSkillModifierRules(data: NativeModuleCatalogData): readonly Gw2ModifierRule[] {
  const rules: Gw2ModifierRule[] = [];
  // Complete owner declarations expose intrinsic modifiers without metadata merge precedence.
  for (const skill of data.skills ?? []) {
    const id = skill.id;
    const scoped = ({ scope = 'skill', ...rule }: SkillModifier, effect: boolean): Gw2ModifierRule => ({
      ...rule,
      // Ownership remains the declaring skill even when a buff affects other skills or actors.
      sourceSkillId: id,
      when: (context) =>
        (scope === 'profession' || String(context.event?.skillId ?? context.skillId) === String(id)) &&
        (!effect || context.event?.effectModifierIds?.includes(rule.id) === true) &&
        (rule.when?.(context) ?? true)
    });
    rules.push(...normalizeSkillModifiers(skill.modifiers ?? [], `Skill ${id}`).map((rule) => scoped(rule, false)));
    for (const effect of skill.effects ?? []) {
      // Patched and untyped declarations can still place modifiers on another effect variant.
      const { modifiers } = effect as { readonly modifiers?: readonly SkillModifier[] };

      if (modifiers == null) continue;

      rules.push(
        ...normalizeSkillEffectModifiers(modifiers, `Skill ${id} effect`, effect.type).map((rule) => scoped(rule, true))
      );
    }
  }

  return rules;
}
