import assert from 'node:assert/strict';
import test from 'node:test';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';
import { defineProfession } from '#gw2/platform/profession-definition/compile-contract.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { planningState } from '#gw2/platform/results/planning-state.js';

// JavaScript definitions must fail before obsolete or misspelled declarations can lose their formulas.
test('profession normalization rejects unsupported modifier declarations', () => {
  for (const define of [defineProfession, defineTestProfession]) {
    for (const key of ['modifyStrikeDamage', 'modifyConditionDamage', 'compileModifierRules', 'unknownModifier']) {
      assert.throws(() => define({ id: 'invalid', name: 'Invalid', modifiers: { [key]: () => 99 } }), {
        name: 'TypeError',
        message: `Unsupported modifiers field: ${key}.`
      });
    }

    for (const modifiers of [false, 1, []]) {
      assert.throws(() => define({ id: 'invalid', name: 'Invalid', modifiers }), /modifiers must be an object/);
    }

    assert.throws(
      () => define({ id: 'invalid', name: 'Invalid', modifiers: { modifierRules: {} } }),
      /modifierRules must be an array/
    );
  }
});

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
      ]
    }
  });

  profession.modifyAttributes({}, {});
  assert.deepEqual(calls, ['first', 'same', 'later']);
  assert.deepEqual(profession.createState({}), {});
  assert.equal(profession.modifyStrikeDamage({}, 12), 12);
  assert.equal(Object.hasOwn(profession, 'ui'), false);
  assert.equal(Object.hasOwn(profession, 'createBuildDefaults'), false);
});

// Projection has one callback; absent or undefined output delegates to the observer's detached fallback.
test('planning projection preserves the selected callback and rejects hook descriptors', () => {
  const project = ({ profession }) => ({ value: profession.value });
  const definition = { id: 'projection-callback', name: 'Projection callback' };
  const selected = defineProfession({ ...definition, resources: { projectPlanningState: project } });
  assert.equal(selected.projectPlanningState, project);
  assert.deepEqual(selected.projectPlanningState({ profession: { value: 3 } }), { value: 3 });
  assert.equal(defineProfession(definition).projectPlanningState({ profession: {} }), undefined);
  for (const invalid of [[project], { id: 'projection', handler: project }])
    assert.throws(
      () => defineProfession({ ...definition, resources: { projectPlanningState: invalid } }),
      /resources.projectPlanningState must be a function/
    );

  const family = defineTestProfession({ ...definition, resources: { createState: () => ({ nested: { value: 3 } }) } });
  for (const projectPlanningState of [undefined, () => undefined]) {
    const runtime = { ...family.runtimeFor({}), projectPlanningState };
    // The result boundary, rather than callback normalization, owns the detached fallback.
    const state = runtime.createState({});
    const result = planningState(
      {
        profession: state,
        time: 0,
        activeWeaponSet: 1,
        config: {},
        catalog: runtime.catalog,
        combatActive: false,
        cooldownController: { cooldownSkillIds: () => [], ammoSkillIds: () => [] }
      },
      runtime.projectPlanningState,
      () => ({ ready: true }),
      []
    );
    result.profession.nested.value = 9;
    assert.equal(state.nested.value, 3);
  }
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

// Each selected owner publishes independent fields without leaking siblings or sharing mutable values.
test('module projections compose Core and only the selected specialization', () => {
  const modules = ['Core', 'First', 'Second'].map((id) =>
    defineNativeModule({
      id,
      data: {},
      state: {
        create: () => ({ [id]: { value: 1 }, [id + 'Private']: true }),
        project: ({ profession }) => ({
          [id]: structuredClone((id === 'Core' ? profession.core : profession.specialization.state)[id])
        })
      }
    })
  );
  const family = defineNativeProfession({ id: 'projection', name: 'Projection', modules });
  for (const specialization of ['Core', 'First', 'Second']) {
    const runtime = family.runtimeFor({ specialization });
    const profession = runtime.createState({ specialization });
    const projected = runtime.projectPlanningState({ profession });
    assert.deepEqual(Object.keys(projected).sort(), [...new Set(['Core', specialization])].sort());
    projected.Core.value = 9;
    assert.equal(profession.core.Core.value, 1);

    if (specialization !== 'Core') {
      projected[specialization].value = 7;
      assert.equal(profession.specialization.state[specialization].value, 1);
    }
  }
});
