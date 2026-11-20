// One shared rule exercises ownership, patch selection and filtering in the modifier reference.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createModifierReference } from '#gw2/app/modifier-reference/model.js';
import { filterModifiers, referenceListHtml } from '#gw2/app/modifier-reference/view.js';

function fixture() {
  const owner = { id: 'owner', name: 'Owner' };
  const contributor = { id: 'contributor', name: 'Contributor' };
  const shared = { id: 'shared', target: 'criticalDamage', operation: 'multiply', factor: 1.25 };
  const strike = { id: 'strike', target: 'strikeDamage', operation: 'damage-additive', amount: 0.1 };
  const reference = { ruleId: shared.id, qualifier: 'Adds to the shared rule' };
  const module = {
    id: 'fixture-line',
    data: {},
    modifiers: { modifierRules: [shared, strike] },
    traitDefinitions: [
      { id: owner.id, modifierRules: [shared, strike] },
      { id: contributor.id, modifierReferences: [reference] }
    ]
  };
  const adapter = {
    profession: { id: 'fixture', name: 'Fixture', nativeDefinition: { modules: [module] } },
    traitTooltip: (entity) => ({ description: entity.name, facts: [] })
  };
  const rules = new Map([
    [shared.id, { ...shared, factor: 2 }],
    [strike.id, strike]
  ]);
  const patch = {
    reworks: [],
    balanceContext: { catalog: { traits: [owner, contributor] }, modifierRulesById: rules }
  };
  return { entries: () => createModifierReference(adapter, patch), owner, contributor, rules, shared, reference };
}

test('the owner shows the selected value and each contributor links to the shared rule once', () => {
  const { entries, owner, contributor, shared, reference, rules } = fixture();
  const result = entries();
  assert.deepEqual(result.map((entry) => entry.name).sort(), [contributor.name, owner.name]);
  const [owned, linked] = [owner, contributor].map((entity) => result.find((entry) => entry.name === entity.name));
  assert.equal(owned.rules.length, 2);
  assert.equal(linked.rules.length, 1);
  const selected = owned.rules.find((rule) => rule.targets.includes('Critical'));
  assert.equal(parseFloat(selected.value), rules.get(shared.id).factor);
  assert.deepEqual(linked.rules[0], { ...selected, qualifier: reference.qualifier, value: undefined });
  assert.ok(referenceListHtml([linked], false).includes(reference.qualifier));
});

test('damage target and bucket must match the same rule within the selected entry', () => {
  const { entries, owner } = fixture();
  const result = entries();
  const filters = {
    profession: 'fixture',
    specialization: 'fixture-line',
    target: 'Critical',
    bucket: 'multiplier',
    q: owner.name
  };
  const matches = (changes) => filterModifiers(result, { ...filters, ...changes }).map((entry) => entry.name);
  assert.deepEqual(matches({}), [owner.name]);
  assert.deepEqual(matches({ target: 'Strike', bucket: 'additive' }), [owner.name]);
  for (const change of [{ bucket: 'additive' }, { profession: 'other' }, { specialization: 'other' }, { q: 'absent' }])
    assert.deepEqual(matches(change), []);
});

test('missing shared rule references identify the unresolved declaration', () => {
  const { entries, reference } = fixture();
  reference.ruleId = 'missing';
  assert.throws(entries, /Missing reference modifier: missing/);
});
