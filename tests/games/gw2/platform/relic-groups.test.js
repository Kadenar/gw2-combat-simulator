import assert from 'node:assert/strict';
import test from 'node:test';
import { RELIC_GROUPS, RELIC_NAMES } from '#gw2/platform/equipment/relics/catalog.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/data.js';

test('shared relic groups include every relic once under its declared category', () => {
  // Verify catalog completeness and metadata membership without maintaining another list of relic names.
  const sortNames = (values) => [...values].sort((left, right) => left.localeCompare(right));
  assert.deepEqual(
    RELIC_GROUPS.map((group) => group.label),
    ['Power', 'Condition', 'Hybrid']
  );
  assert.deepEqual(sortNames(RELIC_GROUPS.flatMap((group) => group.items)), RELIC_NAMES);
  for (const { label, items } of RELIC_GROUPS) {
    assert.ok(items.length > 0);
    assert.deepEqual(items, sortNames(items));
    for (const name of items) assert.equal(RELIC_DATA[name].category, label);
  }
});
