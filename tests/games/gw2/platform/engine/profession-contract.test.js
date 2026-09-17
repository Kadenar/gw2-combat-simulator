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

// Chained hooks receive the previous result even when an intermediate hook only observes it.
test('event preparers and attribute modifiers preserve values through observing hooks', () => {
  for (const [container, hook] of [
    ['schedulerHooks', 'prepareEvent'],
    ['attributeRules', 'modifyAttributes']
  ]) {
    const observed = [];
    const profession = defineProfession({
      id: 'chained',
      name: 'Chained',
      [container]: {
        [hook]: [
          (_context, value) => ({ ...value, power: value.power + 1 }),
          (_context, value) => {
            observed.push(value.power);
          },
          (_context, value) => ({ ...value, power: value.power * 2 })
        ]
      }
    });
    assert.deepEqual(profession[hook]({}, { power: 2 }), { power: 6 });
    assert.deepEqual(observed, [3]);
  }
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

// State factories remain independent while the structured hooks operate on the resulting runtime state.
test('structured definition containers preserve state, recharge rules, and resolver reactions', () => {
  const profession = defineProfession({
    id: 'structured',
    name: 'Structured',
    resources: {
      createProfessionState: (config) => ({ charges: config.charges }),
      createResolverState: () => ({ damage: 0 }),
      projectEndState: ({ resolverState }) => ({ damage: resolverState.damage })
    },
    castRules: {
      modifyRechargeDuration: [(_context, duration) => duration / 2, (_context, duration) => duration + 1]
    },
    resolverHooks: {
      eventHandlers: {
        'structured.damage': (context, event) => {
          context.profession.damage += event.amount;
        }
      },
      eventReactions: {
        'damage.resolved': (context) => {
          context.profession.damage += 1;
        }
      }
    }
  });
  const schedulerState = profession.createProfessionState({ charges: 2 });
  const resolverState = profession.createResolverState({});
  const context = { profession: resolverState };
  profession.eventHandlers['structured.damage'](context, { amount: 3 });
  profession.eventReactions['damage.resolved'](context, {});

  assert.deepEqual(schedulerState, { charges: 2 });
  assert.deepEqual(profession.createResolverState({}), { damage: 0 });
  assert.deepEqual(profession.projectEndState({ resolverState }), { damage: 4 });
  assert.equal(profession.modifyRechargeDuration({}, 10), 6);
});
