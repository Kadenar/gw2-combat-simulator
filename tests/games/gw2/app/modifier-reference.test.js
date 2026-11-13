// The reference includes every declared critical-damage rule and preserves its owner, selected values, and filters.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createModifierReference } from '#gw2/app/modifier-reference/model.js';
import { filterModifiers, referenceListHtml } from '#gw2/app/modifier-reference/view.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { engineerAppAdapter } from '#gw2/professions/engineer/app/app-definition.js';
import { ENGINEER_SKILL_IDS as ENGINEER, ENGINEER_TRAIT_IDS } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { warriorAppAdapter } from '#gw2/professions/warrior/app/app-definition.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';

// Shared bonuses must remain discoverable under each contributing trait without duplicating combat rules.
for (const [profession, name, specialization, bucket, qualifiers] of [
  [
    'elementalist',
    "Familiar's Focus",
    'Evoker',
    'additive',
    {
      Strike: "Improves Familiar's Prowess",
      Condition: "Improves Familiar's Prowess"
    }
  ],
  [
    'guardian',
    "Tyrant's Momentum",
    'Willbender',
    'additive',
    {
      Strike: 'Improves Lethal Tempo',
      Condition: 'Improves Lethal Tempo'
    }
  ],
  [
    'engineer',
    'Enhanced Capacity Storage Unit',
    'Holosmith',
    'multiplier',
    {
      Strike: "Raises Laser's Edge maximum bonus"
    }
  ],
  [
    'engineer',
    'Photonic Blasting Module',
    'Holosmith',
    'multiplier',
    {
      Strike: "Retains Laser's Edge during overheating"
    }
  ],
  [
    'engineer',
    'Mech Core: J-Drive',
    'Mechanist',
    'additive',
    {
      Strike: 'Improves Force Signet',
      Condition: 'Improves Superconducting Signet'
    }
  ],
  [
    'revenant',
    'Ambush Commander',
    'Renegade',
    'additive',
    {
      Strike: "Base Kalla's Fervor bonus",
      Condition: "Base Kalla's Fervor bonus"
    }
  ]
]) {
  test(`${name}: shared modifier references retain trait identity and damage filters`, async () => {
    const adapter = (await import(`#gw2/professions/${profession}/app/app-definition.js`))[`${profession}AppAdapter`];
    for (const id of ['current', ...(adapter.profession.preview ? [adapter.profession.preview.id] : [])]) {
      const entries = createModifierReference(adapter, adapter.profession.resolvePatch({ id }));
      assert.equal(entries.filter((entry) => entry.name === name).length, 1);
      for (const [target, qualifier] of Object.entries(qualifiers)) {
        const matches = filterModifiers(entries, { profession, specialization, target, bucket, q: name });
        assert.equal(matches.length, 1);
        assert.equal(matches[0].source, 'trait');
        assert.ok(matches[0].icons.length > 0);
        assert.ok(matches[0].rules.some((rule) => rule.targets.includes(target) && rule.qualifier === qualifier));
        assert.match(referenceListHtml(matches, false), /modifier-reference-entry/);
        assert.equal(
          filterModifiers(entries, { profession, specialization, target: 'Critical', bucket, q: name }).length,
          0
        );
      }
    }
  });
}

test('shared modifier references use patched trait facts without claiming the combined rule value', () => {
  const profession = withPatchPreview(engineerProfession, {
    id: 'shared-modifier-reference',
    label: 'Shared modifier reference',
    professions: {
      engineer: {
        balanceProfiles: {
          [ENGINEER_TRAIT_IDS.MECH_CORE_J_DRIVE]: { fields: { damageIncrease: 0.25, conditionDamageIncrease: 0.2 } }
        }
      }
    }
  });
  const patch = profession.resolvePatch({ id: profession.preview.id });
  // A shared rule can resolve to a constant; only its owner should present that combined value.
  const modifierRulesById = new Map(patch.balanceContext.modifierRulesById);
  modifierRulesById.set('engineer.lasers-edge', { ...modifierRulesById.get('engineer.lasers-edge'), factor: 1.5 });
  const entries = createModifierReference(engineerAppAdapter, {
    ...patch,
    balanceContext: { ...patch.balanceContext, modifierRulesById }
  });
  const drive = entries.find((entry) => entry.name === 'Mech Core: J-Drive');
  assert.equal(drive.tooltip.facts.find((fact) => fact.name === 'Force Signet strike bonus').detail, '+25%');
  assert.equal(
    drive.tooltip.facts.find((fact) => fact.name === 'Superconducting Signet condition bonus').detail,
    '+20%'
  );
  assert.equal(entries.find((entry) => entry.name === "Laser's Edge").rules[0].value, '1.5×');
  for (const name of ['Enhanced Capacity Storage Unit', 'Photonic Blasting Module']) {
    assert.equal(entries.find((entry) => entry.name === name).rules[0].value, undefined);
  }
});

test('shared modifier references reject unresolved rule ids', () => {
  const patch = engineerAppAdapter.profession.resolvePatch({ id: 'current' });
  const modifierRulesById = new Map(patch.balanceContext.modifierRulesById);
  modifierRulesById.delete('engineer.lasers-edge');
  assert.throws(
    () =>
      createModifierReference(engineerAppAdapter, {
        ...patch,
        balanceContext: { ...patch.balanceContext, modifierRulesById }
      }),
    /Missing reference modifier: engineer.lasers-edge/
  );
});

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
