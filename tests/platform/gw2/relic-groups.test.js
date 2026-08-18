import assert from 'node:assert/strict';
import test from 'node:test';
import { RELIC_DATA, RELIC_GROUPS, RELIC_NAMES } from '../../../js/platform/gw2/gear-data.js';

function assertCompleteGroups(groups, names, data) {
  const groupedNames = groups.flatMap((group) => group.items);
  const sortNames = (values) => [...values].sort((left, right) => left.localeCompare(right));

  assert.deepEqual(
    groups.map((group) => group.label),
    ['Power', 'Condition', 'Hybrid']
  );
  assert.equal(groupedNames.length, names.length);
  assert.equal(new Set(groupedNames).size, names.length);
  assert.deepEqual(sortNames(groupedNames), names);
  assert.ok(groups.every((group) => group.items.length > 0));
  assert.ok(names.every((name) => data[name]));
}

test('shared relics are grouped by their damage effect', () => {
  assertCompleteGroups(RELIC_GROUPS, RELIC_NAMES, RELIC_DATA);
  assert.deepEqual(RELIC_GROUPS, [
    {
      label: 'Power',
      items: [
        'Brawler',
        'Bloodstone',
        'Claw',
        'Deadeye',
        'Dragonhunter',
        'Eagle',
        'Fireworks',
        'Mist Stranger',
        'Mistburn',
        'Shackles',
        'Thief'
      ]
    },
    {
      label: 'Condition',
      items: ['Akeem', 'Aristocracy', 'Blightbringer', 'Fractal', 'Steamshrieker', 'Thorns']
    },
    {
      label: 'Hybrid',
      items: ['Nourys', 'Peitha']
    }
  ]);
});
