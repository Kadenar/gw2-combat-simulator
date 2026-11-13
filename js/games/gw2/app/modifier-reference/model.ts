/** Build the reference from production declarations, preserving trait ownership and selected balance rules. */
import type { SimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import type { Gw2AppAdapter } from '#gw2/app/types.js';
import type { ResolvedPatch } from '#gw2/integrations/patches/selection.js';
import { modifierRuleLabel, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export interface ReferenceRule {
  readonly targets: readonly string[];
  readonly bucket: 'additive' | 'multiplier';
  readonly value?: string;
  readonly qualifier?: string;
}

export interface ModifierReferenceEntry {
  readonly profession: string;
  readonly professionName: string;
  readonly name: string;
  readonly icons: readonly string[];
  readonly skills: readonly Skill[];
  readonly specializations: readonly string[];
  readonly group: string;
  readonly source: 'trait' | 'utility' | 'weapon' | 'mechanic';
  readonly tooltip: SimulationTooltip;
  readonly rules: readonly ReferenceRule[];
}

// Critical damage has its own category because it scales only the critical portion of strike damage.
const DAMAGE_TARGET_LABELS = new Map([
  ['strikeDamage', 'Strike'],
  ['conditionDamage', 'Condition'],
  ['criticalDamage', 'Critical']
]);

/** Include outgoing and critical damage while leaving chance, duration, and attribute rules outside this reference. */
function damageRule(rule: Gw2ModifierRule): boolean {
  return [rule.target].flat().some((target) => DAMAGE_TARGET_LABELS.has(target));
}

function describeRule(rule: Gw2ModifierRule, qualifier?: string): ReferenceRule {
  const additive = rule.operation === 'damage-additive' || rule.operation === 'add';
  const value = additive ? rule.amount : rule.factor;
  return {
    qualifier,
    targets: [rule.target].flat().flatMap((target) => {
      const label = DAMAGE_TARGET_LABELS.get(target);
      return label ? [label] : [];
    }),
    bucket: additive ? 'additive' : 'multiplier',
    value:
      typeof value === 'number'
        ? additive
          ? `${Number((value * 100).toFixed(4))}${rule.operation === 'add' ? ' percentage points' : '%'}`
          : `${Number(value.toFixed(4))}×`
        : // Resolver-backed amounts are described by the existing skill/trait facts, not guessed from execution.
          undefined
  };
}

export function createModifierReference(
  adapter: Pick<Gw2AppAdapter, 'profession' | 'traitTooltip' | 'skillTooltip' | 'modifierPresentation'>,
  patch: ResolvedPatch
): readonly ModifierReferenceEntry[] {
  const { profession } = adapter;
  const definition = profession.nativeDefinition;
  const replacements = new Map(
    patch.reworks.map((id) => {
      const module = definition.moduleVariants?.[id];

      if (!module) throw new Error(`Missing reference module: ${id}`);

      return [module.id, module] as const;
    })
  );
  const modules = definition.modules.map((module) => replacements.get(module.id) ?? module);
  const entries: ModifierReferenceEntry[] = [];
  // A shared skill can belong to several modules, as with pet and merged-player versions of Sic 'Em.
  const mechanics = new Map<string, ModifierReferenceEntry>();
  const { catalog, modifierRulesById } = patch.balanceContext;
  const selectedRule = (id: string): Gw2ModifierRule => {
    const rule = modifierRulesById.get(id);

    if (!rule) throw new Error(`Missing reference modifier: ${id}`);

    return rule;
  };

  for (const module of modules) {
    const owned = new Set<string>();
    for (const trait of module.traitDefinitions ?? []) {
      const rules = (trait.modifierRules ?? [])
        .map((rule) => {
          owned.add(rule.id);
          return selectedRule(rule.id);
        })
        .filter(damageRule)
        .map((rule) => describeRule(rule));

      // Shared rules supply damage categories; each referring trait supplies its own facts and relationship.
      for (const reference of trait.modifierReferences ?? []) {
        const rule = selectedRule(reference.ruleId);

        if (damageRule(rule)) rules.push({ ...describeRule(rule, reference.qualifier), value: undefined });
      }

      if (!rules.length) continue;

      const entity = catalog.traits.find((entity) => entity.id === trait.id);

      if (!entity) throw new Error(`Missing reference trait: ${trait.id}`);

      const line = module.data.traitLines?.find((line) =>
        [...line.minorTraits, ...line.majorTraits.flat()].some(({ id }) => id === trait.id)
      );
      entries.push({
        profession: profession.id,
        professionName: profession.name,
        name: entity.name,
        icons: entity.icon ? [entity.icon] : [],
        skills: [],
        specializations: [line?.name ?? module.id],
        group: line?.name ?? module.id,
        source: 'trait',
        tooltip: adapter.traitTooltip(entity, patch, module.id),
        rules
      });
    }

    // Combine split damage channels only when both the owning skill and displayed modifier name agree.
    for (const declaration of module.modifiers.modifierRules ?? []) {
      if (owned.has(declaration.id)) continue;

      const rule = selectedRule(declaration.id);

      if (!damageRule(rule)) continue;

      const presentation = adapter.modifierPresentation(rule, patch);

      if (presentation === null) continue;

      const label = modifierRuleLabel(rule);
      const name = presentation?.name ?? label;
      const ids =
        presentation?.skills ??
        (rule.sourceSkillId != null
          ? [rule.sourceSkillId]
          : catalog.skills.filter((skill) => skill.name === label).map((skill) => skill.id));
      const skills = ids.map((id) => {
        const skill = catalog.skillsById.get(id);

        if (!skill) throw new Error(`Missing source skill ${id} for modifier ${rule.id}`);

        return skill;
      });

      if (!skills.length) throw new Error(`Missing source attribution for modifier ${rule.id}`);

      const key = JSON.stringify([skills.map((skill) => String(skill.id)).sort(), name]);
      const previous = mechanics.get(key);
      const source =
        presentation?.category ??
        (skills.every((skill) => skill.type === 'Weapon')
          ? 'weapon'
          : skills.some((skill) => ['Heal', 'Utility', 'Elite'].includes(skill.type ?? ''))
            ? 'utility'
            : 'mechanic');
      const tooltip = presentation ?? adapter.skillTooltip(skills[0], patch);
      mechanics.set(key, {
        profession: profession.id,
        professionName: profession.name,
        name,
        icons: presentation?.icon
          ? [presentation.icon]
          : [...new Set(skills.flatMap((skill) => (skill.icon ? [skill.icon] : [])))],
        skills,
        specializations: [...new Set([...(previous?.specializations ?? []), module.id])],
        group: source === 'weapon' ? 'Weapon Skills' : source === 'utility' ? 'Utility Skills' : 'Profession Mechanics',
        source,
        tooltip: previous
          ? {
              description: [...new Set([previous.tooltip.description, tooltip.description])].filter(Boolean).join('\n'),
              facts: uniqueFacts([...previous.tooltip.facts, ...tooltip.facts]),
              factTabs: uniqueFacts([...(previous.tooltip.factTabs ?? []), ...(tooltip.factTabs ?? [])]),
              // Preserve conditional groups when several mechanic sources share one reference entry.
              factSections: uniqueFacts([...(previous.tooltip.factSections ?? []), ...(tooltip.factSections ?? [])])
            }
          : tooltip,
        rules: [...(previous?.rules ?? []), describeRule(rule, presentation?.qualifier)]
      });
    }
  }

  entries.push(...mechanics.values());
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/** Merged strike/condition declarations should share their description and facts, not repeat the skill card. */
function uniqueFacts<T>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [JSON.stringify(value), value])).values()];
}
