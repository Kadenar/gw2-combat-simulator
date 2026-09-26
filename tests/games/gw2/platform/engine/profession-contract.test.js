import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';
import { createEventReactions, defineProfession } from '#gw2/platform/engine/profession/contract.js';

// Profession contracts provide neutral defaults and deterministic hooks for every implementation.
test('profession contract supplies defaults and deterministic hook ordering', () => {
  const calls = [];
  const profession = defineProfession({
    id: 'ordered',
    name: 'Ordered',
    attributeRules: {
      modifyAttributes: [
        { id: 'later', order: 20, handler: () => calls.push('later') },
        { id: 'first', order: 10, handler: () => calls.push('first') },
        { id: 'same', order: 10, handler: () => calls.push('same') }
      ],
      reactions: {
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

  profession.modifyAttributes({}, {});
  assert.deepEqual(calls, ['first', 'same', 'later']);
  createEventReactions({
    control: [
      { id: 'later', order: 20, handler: () => calls.push('later-control') },
      { id: 'first', order: 10, handler: () => calls.push('first-control') }
    ]
  }).control({}, { type: 'control' });
  assert.deepEqual(calls, ['first', 'same', 'later', 'first-control', 'later-control']);
  assert.deepEqual(profession.createState({}), {});
  assert.equal(profession.modifyStrikeDamage({}, 12), 12);
  assert.equal(Object.hasOwn(profession, 'ui'), false);
  assert.equal(Object.hasOwn(profession, 'createBuildDefaults'), false);
});

// Chained hooks receive the previous result even when an intermediate hook only observes it.
test('attribute modifiers preserve values through observing hooks', () => {
  for (const [container, hook] of [['attributeRules', 'modifyAttributes']]) {
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

// Resource presentation is normalized by its own application adapter.
test('presentation contract supports zero or multiple resource views', () => {
  const none = normalizeProfessionUi('resourceless');
  const multiple = normalizeProfessionUi('multi-resource', {
    resourceViews: () => [
      { id: 'pages', maximum: 5, value: 2 },
      { id: 'charges', maximum: 3, value: 1 }
    ]
  });
  assert.deepEqual(none.resourceViews({}), []);
  assert.equal(multiple.resourceViews({}).length, 2);
});

// Fresh states share one factory while the structured hooks operate on the resulting runtime state.
test('structured definition containers preserve state, recharge rules, and resolver reactions', () => {
  const profession = defineProfession({
    id: 'structured',
    name: 'Structured',
    resources: {
      createState: (config) => ({ charges: config.charges ?? 0, damage: 0 }),
      projectPlanningState: ({ profession }) => ({ damage: profession.damage })
    },
    hooks: {
      rechargeWork: (_context, _skill, duration) => duration / 2 + 1,
      eventHandlers: {
        'structured.damage': (context, event) => {
          context.profession.damage += event.amount;
        }
      },
      reactions: {
        'damage.resolved': (context) => {
          context.profession.damage += 1;
        }
      }
    }
  });
  const firstState = profession.createState({ charges: 2 });
  const resolverState = profession.createState({});
  const context = { profession: resolverState };
  profession.runtimeFor({}).eventHandlers['structured.damage'](context, { amount: 3 });
  profession.runtimeFor({}).reactions['damage.resolved'](context, {});

  assert.deepEqual(firstState, { charges: 2, damage: 0 });
  assert.deepEqual(profession.createState({}), { charges: 0, damage: 0 });
  assert.deepEqual(profession.projectPlanningState({ profession: resolverState }), { damage: 4 });
  assert.equal(profession.runtimeFor({}).rechargeWork({}, {}, 10), 6);
});
