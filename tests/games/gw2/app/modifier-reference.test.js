// The reference includes every declared critical-damage rule and preserves its owner, selected values, and filters.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createModifierReference } from '#gw2/app/modifier-reference/model.js';
import { filterModifiers, referenceListHtml } from '#gw2/app/modifier-reference/view.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { engineerAppAdapter } from '#gw2/professions/engineer/app/app-definition.js';
import { ENGINEER_SKILL_IDS as ENGINEER } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { warriorAppAdapter } from '#gw2/professions/warrior/app/app-definition.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';

// Dynamic modifier factors need a numeric fact from the selected skill data in both tooltip and reference.
test('Static Discharge reports its selected critical-damage amplification', () => {
  const profession = withPatchPreview(engineerProfession, {
    id: 'static-discharge-reference',
    label: 'Static Discharge reference',
    professions: {
      engineer: { skills: { [ENGINEER.STATIC_DISCHARGE_TRAIT_SKILL]: { fields: { criticalDamage: 2.5 } } } }
    }
  });
  for (const [id, expected] of [
    ['current', '+100%'],
    ['static-discharge-reference', '+150%']
  ]) {
    const patch = profession.resolvePatch({ id });
    const skill = patch.balanceContext.catalog.skillsById.get(ENGINEER.STATIC_DISCHARGE_TRAIT_SKILL);
    const tooltip = engineerAppAdapter.skillTooltip(skill, patch);
    const entry = createModifierReference(engineerAppAdapter, patch).find((entry) => entry.name === 'Static Discharge');
    for (const model of [tooltip, entry.tooltip]) {
      assert.equal(model.facts.find((fact) => fact.name === 'Critical damage amplification')?.detail, expected);
    }

    assert.ok(referenceListHtml([entry], false).includes(expected));
  }
});

for (const name of [
  'elementalist',
  'engineer',
  'guardian',
  'mesmer',
  'necromancer',
  'ranger',
  'revenant',
  'thief',
  'warrior'
]) {
  test(`${name}: all critical-damage rules appear under their canonical owners in each balance version`, async () => {
    const adapter = (await import(`#gw2/professions/${name}/app/app-definition.js`))[`${name}AppAdapter`];
    const profession = adapter.profession;
    for (const id of ['current', ...(profession.preview ? [profession.preview.id] : [])]) {
      const patch = profession.resolvePatch({ id });
      const entries = createModifierReference(adapter, patch);
      const criticalRules = [...patch.balanceContext.modifierRulesById.values()].filter((rule) =>
        [rule.target].flat().includes('criticalDamage')
      );
      assert.equal(
        entries.flatMap((entry) => entry.rules).filter((rule) => rule.targets.includes('Critical')).length,
        criticalRules.length,
        id
      );
      const modules = profession.nativeDefinition.modules.map(
        (module) =>
          patch.reworks
            .map((rework) => profession.nativeDefinition.moduleVariants[rework])
            .find((variant) => variant.id === module.id) ?? module
      );
      for (const rule of criticalRules) {
        const trait = modules
          .flatMap((module) => module.traitDefinitions ?? [])
          .find((trait) => trait.modifierRules?.some((owned) => owned.id === rule.id));
        const owner = trait ? patch.balanceContext.catalog.traits.find((entity) => entity.id === trait.id) : null;
        const entry = entries.find((entry) =>
          owner
            ? entry.source === 'trait' && entry.name === owner.name
            : entry.skills.some((skill) => skill.id === rule.sourceSkillId)
        );
        assert.ok(
          entry?.rules.some((rule) => rule.targets.includes('Critical')),
          `${id}: ${rule.id}`
        );
      }
    }
  });
}

// Critical-only attacks must be searchable without being mislabeled as unconditional strike bonuses.
test('critical damage filters, values, and rendered labels follow the selected patch', () => {
  const profession = withPatchPreview(warriorProfession, {
    id: 'critical-reference',
    label: 'Critical reference',
    professions: { warrior: { modifierRules: { 'warrior.precise-cut-critical-damage': { factor: 1.25 } } } }
  });
  for (const [id, value] of [
    ['current', '1.15×'],
    ['critical-reference', '1.25×']
  ]) {
    const entries = createModifierReference(warriorAppAdapter, profession.resolvePatch({ id }));
    const filters = {
      profession: 'warrior',
      specialization: '',
      target: 'Critical',
      bucket: 'multiplier',
      q: 'Precise Cut'
    };
    const selected = filterModifiers(entries, filters);
    assert.equal(selected.length, 1);
    assert.deepEqual(selected[0].rules, [{ targets: ['Critical'], bucket: 'multiplier', value, qualifier: undefined }]);
    assert.equal(filterModifiers(entries, { ...filters, target: 'Strike' }).length, 0);
    assert.equal(filterModifiers(entries, { ...filters, bucket: 'additive' }).length, 0);
    const html = referenceListHtml(selected, false);
    assert.match(html, /Critical damage/);
    assert.ok(html.includes(value));
  }
});
