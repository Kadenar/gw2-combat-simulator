import { createPublicStateProjector } from '#gw2/platform/engine/profession/state.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';
import { createEventReactions, defineProfession } from '#gw2/platform/engine/profession/contract.js';

// Profession contracts provide neutral defaults and deterministic hooks for every implementation.
test('profession contract supplies defaults and deterministic hook ordering', () => {
  const calls = [];
  const profession = defineProfession({
    id: 'ordered',
    name: 'Ordered',
    modifiers: {
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
  for (const [container, hook] of [['modifiers', 'modifyAttributes']]) {
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
  const profession = defineNativeProfession({
    id: 'structured',
    name: 'Structured',
    modules: [
      defineNativeModule({
        id: 'Core',
        data: {},
        state: {
          create: (config) => ({ charges: config.charges ?? 0, damage: 0 }),
          project: ({ profession }) => ({ damage: profession.core.damage })
        },
        hooks: {
          rechargeWork: (_context, _skill, duration) => duration / 2 + 1,
          eventHandlers: {
            'structured.damage': (context, event) => {
              context.profession.core.damage += event.amount;
            }
          },
          reactions: {
            'damage.resolved': (context) => {
              context.profession.core.damage += 1;
            }
          }
        }
      })
    ]
  }).runtimeFor({});
  const firstState = profession.createState({ charges: 2 });
  const resolverState = profession.createState({});
  const context = { profession: resolverState };
  profession.eventHandlers['structured.damage'](context, { amount: 3 });
  profession.reactions['damage.resolved'](context, {});

  assert.deepEqual(firstState.core, { charges: 2, damage: 0 });
  assert.deepEqual(profession.createState({}).core, { charges: 0, damage: 0 });
  assert.deepEqual(profession.projectPlanningState({ profession: resolverState }), { damage: 4 });
  assert.equal(profession.rechargeWork({}, {}, 10), 6);
});

// The selected module overrides Core's public fields without publishing siblings or sharing mutable values.
test('module projections compose Core and only the selected specialization', () => {
  const modules = ['Core', 'First', 'Second'].map((id) =>
    defineNativeModule({
      id,
      data: {},
      state: {
        create: () => ({ [id]: { value: 1 }, [id + 'Private']: true }),
        project: (input) => ({ ...createPublicStateProjector({ keys: [id], defaults: {} })(input), shared: id })
      }
    })
  );
  const family = defineNativeProfession({ id: 'projection', name: 'Projection', modules });
  for (const specialization of ['Core', 'First', 'Second']) {
    const runtime = family.runtimeFor({ specialization });
    const profession = runtime.createState({ specialization });
    const projected = runtime.projectPlanningState({ profession });
    assert.equal(projected.shared, specialization);
    assert.deepEqual(Object.keys(projected).sort(), [...new Set(['shared', 'Core', specialization])].sort());
    projected.Core.value = 9;
    assert.equal(profession.core.Core.value, 1);
    if (specialization !== 'Core') {
      projected[specialization].value = 7;
      assert.equal(profession.specialization.state[specialization].value, 1);
    }
  }
});
