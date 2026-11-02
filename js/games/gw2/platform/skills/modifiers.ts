import { createModifierHooks, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { NativeModuleCatalogData } from '#gw2/platform/profession-definition/module-types.js';

/** Intrinsic bonuses use shared strike buckets or critical-factor arithmetic, scoped automatically to their owner. */
export type SkillDamageModifier = Pick<
  Gw2ModifierRule,
  'id' | 'label' | 'amount' | 'factor' | 'parameters' | 'when' | 'order'
> &
  (
    | { readonly target: 'strikeDamage'; readonly operation: 'multiply' | 'damage-additive' }
    | { readonly target: 'criticalDamage'; readonly operation: 'multiply' | 'add' }
  );

const FIELDS = new Set(['id', 'label', 'target', 'operation', 'amount', 'factor', 'parameters', 'when', 'order']);

/** Validate authoring at the catalog boundary, retaining only immutable declarations and existing formula semantics. */
export function normalizeSkillDamageModifiers(value: unknown, label: string): readonly SkillDamageModifier[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} modifiers must be an array.`);

  if (!value.length) return Object.freeze([]);

  for (const rule of value) {
    if (
      !rule ||
      typeof rule !== 'object' ||
      Array.isArray(rule) ||
      Object.keys(rule).some((field) => !FIELDS.has(field)) ||
      !['strikeDamage', 'criticalDamage'].includes(rule.target)
    ) {
      throw new TypeError(`${label} has an invalid skill damage modifier.`);
    }
  }

  // Shared validation enforces damage-additive strike buckets versus additive critical factors.
  createModifierHooks({ rules: value });
  return Object.freeze(
    value.map((rule) =>
      Object.freeze({
        ...rule,
        ...(rule.parameters ? { parameters: Object.freeze({ ...rule.parameters }) } : {})
      })
    )
  );
}

/** Register skill declarations once with module rules so canonical compilation and balance authoring share them. */
export function nativeSkillModifierRules(data: NativeModuleCatalogData): readonly Gw2ModifierRule[] {
  const rules: Gw2ModifierRule[] = [];
  // Complete owner declarations expose intrinsic modifiers without metadata merge precedence.
  for (const skill of data.skills ?? []) {
    const id = skill.id;
    const scoped = (rule: SkillDamageModifier, effect: boolean): Gw2ModifierRule => ({
      ...rule,
      when: (context) =>
        String(context.event?.skillId ?? context.skillId) === String(id) &&
        (!effect || context.event?.effectModifierIds?.includes(rule.id) === true) &&
        (rule.when?.(context) ?? true)
    });
    rules.push(
      ...normalizeSkillDamageModifiers(skill.modifiers ?? [], `Skill ${id}`).map((rule) => scoped(rule, false))
    );
    for (const effect of skill.effects ?? []) {
      // Patched and untyped declarations can still place modifiers on another effect variant.
      const { modifiers } = effect as { readonly modifiers?: readonly SkillDamageModifier[] };

      if (modifiers == null) continue;

      if (effect.type !== 'strike') throw new TypeError(`Skill ${id} modifiers require a strike effect.`);

      rules.push(...normalizeSkillDamageModifiers(modifiers, `Skill ${id} effect`).map((rule) => scoped(rule, true)));
    }
  }

  return rules;
}
