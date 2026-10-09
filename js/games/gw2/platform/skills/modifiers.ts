import { createModifierHooks, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { NativeModuleCatalogData } from '#gw2/platform/profession-definition/module-types.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Intrinsic strike bonuses use the ordinary damage buckets and traces, scoped automatically to their owner. */
export interface SkillDamageModifier extends Pick<
  Gw2ModifierRule,
  'id' | 'label' | 'amount' | 'factor' | 'parameters' | 'when' | 'order'
> {
  readonly target: 'strikeDamage';
  readonly operation: 'multiply' | 'damage-additive';
}

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
      rule.target !== 'strikeDamage' ||
      !['multiply', 'damage-additive'].includes(rule.operation)
    ) {
      throw new TypeError(`${label} has an invalid skill damage modifier.`);
    }
  }

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

/** Register skill declarations once with module rules so custom compilers, ordering, and balance authoring share them. */
export function nativeSkillModifierRules(data: NativeModuleCatalogData): readonly Gw2ModifierRule[] {
  const skills = new Map<string, Partial<Skill>>();
  for (const skill of [...(data.generatedSkills ?? []), ...(data.extraSkills ?? [])]) {
    skills.set(String(skill.id), skill);
  }

  for (const fragments of [data.skillMechanics, data.skillOverrides]) {
    for (const [id, fragment] of Object.entries(fragments ?? {})) {
      skills.set(id, { ...skills.get(id), ...fragment });
    }
  }

  const rules: Gw2ModifierRule[] = [];
  for (const [key, skill] of skills) {
    const id: SkillId = skill.id ?? key;
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
      if (effect.modifiers == null) continue;
      if (effect.type !== 'strike') throw new TypeError(`Skill ${id} modifiers require a strike effect.`);
      rules.push(
        ...normalizeSkillDamageModifiers(effect.modifiers, `Skill ${id} effect`).map((rule) => scoped(rule, true))
      );
    }
  }

  return rules;
}
