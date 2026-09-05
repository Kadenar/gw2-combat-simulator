import assert from 'node:assert/strict';
import test from 'node:test';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';

// Profession contracts provide neutral defaults and deterministic hooks for every implementation.
test('profession contract supplies defaults and deterministic hook ordering', () => {
  const calls = [];
  const profession = defineProfession({
    id: 'ordered',
    name: 'Ordered',
    schedulerHooks: {
      initialize: [
        { id: 'later', order: 20, handler: () => calls.push('later') },
        { id: 'first', order: 10, handler: () => calls.push('first') },
        { id: 'same', order: 10, handler: () => calls.push('same') }
      ]
    },
    resolverHooks: {
      eventReactions: {
        control: [
          {
            id: 'later-control',
            order: 20,
            handler: () => calls.push('later-control')
          },
          {
            id: 'first-control',
            order: 10,
            handler: () => calls.push('first-control')
          }
        ]
      }
    }
  });

  profession.initialize({});
  assert.deepEqual(calls, ['first', 'same', 'later']);
  profession.eventReactions.control({}, { type: 'control' });
  assert.deepEqual(calls, ['first', 'same', 'later', 'first-control', 'later-control']);
  assert.deepEqual(profession.availability({}, {}), { ready: true });
  assert.deepEqual(profession.createProfessionState({}), {});
  assert.equal(profession.modifyStrikeDamage({}, 12), 12);
  assert.deepEqual(profession.paletteGroups({}), []);
});

test('profession contract supports zero or multiple resource views', () => {
  const none = defineProfession({
    id: 'resourceless',
    name: 'Resourceless'
  });
  const multiple = defineProfession({
    id: 'multi-resource',
    name: 'Multi Resource',
    ui: {
      resourceViews: () => [
        { id: 'pages', maximum: 5, value: 2 },
        { id: 'charges', maximum: 3, value: 1 }
      ]
    }
  });

  assert.deepEqual(none.ui.resourceViews({}), []);
  assert.equal(multiple.ui.resourceViews({}).length, 2);
});
