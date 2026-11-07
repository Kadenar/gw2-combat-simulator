import assert from 'node:assert/strict';
import test from 'node:test';

import { createAutoattackChainController } from '#gw2/platform/execution/autoattack-chains.js';
import { defineProfession } from '#gw2/platform/profession-definition/compile-contract.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { planningState } from '#gw2/platform/results/planning-state.js';
import { SHARED_STATE_IDS } from '#gw2/platform/results/state-ids.js';
import { resolvedTestHitDetails } from '#tests/helpers/gw2-resolver.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { professionUiFixture } from '#tests/helpers/presentation.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

// JavaScript definitions must fail before obsolete or misspelled declarations can lose their formulas.
test('profession normalization rejects unsupported modifier declarations', () => {
  for (const define of [defineProfession, defineTestProfession]) {
    for (const key of [
      'modifyAttributes',
      'modifyConditionAttributes',
      'modifyCriticalChance',
      'modifyCriticalDamage',
      'modifyConditionBaseDuration',
      'modifyConditionDuration',
      'modifyStrikeDamage',
      'modifyConditionDamage',
      'compileModifierRules',
      'unknownModifier'
    ]) {
      for (const value of [() => 99, { id: 'ordered', order: 1, handler: () => 99 }, [() => 99]])
        assert.throws(() => define({ id: 'invalid', name: 'Invalid', modifiers: { [key]: value } }), {
          name: 'TypeError',
          message: `Unsupported modifiers field: ${key}.`
        });
    }
  }

  // Fixture runtime overrides cannot restore imperative evaluators, while genuine runtime hooks stay available.
  const definition = { id: 'fixture', name: 'Fixture' };
  assert.throws(() => defineTestProfession({ ...definition, hooks: { modifyCriticalChance: () => 99 } }), {
    name: 'TypeError',
    message: 'Unsupported hooks field: modifyCriticalChance.'
  });
  for (const key of ['calculations', 'attributeContributions', 'modifyConditionAttributes'])
    assert.throws(() => defineTestProfession({ ...definition, hooks: { [key]: {} } }), {
      name: 'TypeError',
      message: `Unsupported hooks field: ${key}.`
    });
  const modifyEffects = () => [];
  assert.equal(
    defineTestProfession({ ...definition, hooks: { modifyEffects } }).runtimeFor().modifyEffects,
    modifyEffects
  );
});

// Empty declarations retain the query API without installing an imperative authoring path.
test('profession contract supplies neutral calculation defaults', () => {
  const profession = defineProfession({
    id: 'ordered',
    name: 'Ordered'
  });

  assert.equal(Object.isFrozen(profession.calculations), true);
  // Evaluators have exactly one public owner; callers cannot find an obsolete flat alias.
  for (const key of Object.keys(profession.calculations)) assert.equal(Object.hasOwn(profession, key), false);
  const attributes = { power: 123 };
  assert.equal(profession.calculations.modifyAttributes({ catalog: profession.catalog }, attributes), attributes);
  assert.equal(
    profession.calculations.modifyConditionAttributes({ catalog: profession.catalog }, attributes),
    attributes
  );
  for (const name of [
    'modifyCriticalChance',
    'modifyCriticalDamage',
    'modifyConditionBaseDuration',
    'modifyConditionDuration'
  ])
    assert.equal(profession.calculations[name]({}, 1.5), 1.5);
  assert.deepEqual(profession.createState({}), {});
  assert.equal(profession.calculations.modifyStrikeDamage({ catalog: profession.catalog }, 12), 12);
  assert.equal(Object.hasOwn(profession, 'ui'), false);
  assert.equal(Object.hasOwn(profession, 'createBuildDefaults'), false);
});

// Compilation preserves explicit selectors and gives definitions without observations an empty projection.
test('planning projection preserves the selected callback', () => {
  const project = ({ profession }) => ({ value: profession.value });
  const definition = { id: 'projection-callback', name: 'Projection callback' };
  const selected = defineProfession({ ...definition, resources: { projectPlanningState: project } });
  assert.equal(selected.projectPlanningState, project);
  assert.deepEqual(selected.projectPlanningState({ profession: { value: 3 } }), { value: 3 });
  assert.deepEqual(defineProfession(definition).projectPlanningState({ profession: { privateValue: 3 } }), {});
});

// The observer detaches declared fields and never exports private fields when the selector contributes nothing.
test('planning observations require explicit projection and retain shared execution fields', () => {
  const family = defineTestProfession({
    id: 'projection-isolation',
    name: 'Projection isolation',
    resources: { createState: () => ({ nested: { value: 3 }, privateValue: 1 }) }
  });
  const project = ({ profession }) => ({ observed: profession.nested });
  for (const projectPlanningState of [family.projectPlanningState, () => undefined, () => ({}), project]) {
    const runtime = { ...family.runtimeFor({}), projectPlanningState };
    const state = runtime.createState({});
    const result = planningState(
      {
        profession: state,
        flips: {},
        autoattackController: createAutoattackChainController(runtime.catalog),
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
    assert.deepEqual(result.profession, {
      ...(projectPlanningState === project ? { observed: { value: 3 } } : {}),
      [SHARED_STATE_IDS.AVAILABLE_FLIPS]: {},
      [SHARED_STATE_IDS.AUTOATTACK_CHAINS]: {}
    });

    if (projectPlanningState === project) {
      result.profession.observed.value = 9;
      assert.equal(state.nested.value, 3);
      state.nested.value = 7;
      assert.equal(result.profession.observed.value, 9);
    }
  }
});

// The presentation composer supplies empty resource views when no slice owns them.
test('presentation contract supports zero or multiple resource views', () => {
  const none = professionUiFixture();
  const multiple = professionUiFixture({
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
  profession.reactions['damage.resolved'](context, {}, resolvedTestHitDetails());

  assert.deepEqual(firstState.core, { charges: 2, damage: 0 });
  assert.deepEqual(profession.createState({}).core, { charges: 0, damage: 0 });
  assert.deepEqual(profession.projectPlanningState({ profession: resolverState }), { damage: 4 });
  assert.equal(profession.rechargeWork({}, {}, 10), 6);
});

// Each selected owner publishes independent fields without leaking siblings or sharing mutable values.
// Shared execution adds only its own visible flip windows beside them.
test('module projections compose Core and only the selected specialization', () => {
  const modules = ['Core', 'First', 'Second'].map((id) =>
    defineNativeModule({
      id,
      data: {},
      state: {
        create: () => ({ [id]: { value: 1 }, [id + 'Private']: true }),
        project: ({ profession }) => ({
          [id]: (id === 'Core' ? profession.core : profession.specialization.state)[id]
        })
      }
    })
  );
  const family = defineNativeProfession({ id: 'projection', name: 'Projection', modules });
  for (const specialization of ['Core', 'First', 'Second']) {
    const runtime = family.runtimeFor({ specialization });
    const profession = runtime.createState({ specialization });
    const projected = projectObservedState(family, { profession });
    assert.deepEqual(
      Object.keys(projected).sort(),
      [
        ...new Set(['Core', specialization, SHARED_STATE_IDS.AVAILABLE_FLIPS, SHARED_STATE_IDS.AUTOATTACK_CHAINS])
      ].sort()
    );
    projected.Core.value = 9;
    assert.equal(profession.core.Core.value, 1);

    if (specialization !== 'Core') {
      projected[specialization].value = 7;
      assert.equal(profession.specialization.state[specialization].value, 1);
    }
  }
});

// Either owner may omit its selector, including both at once, without exposing its private slice.
test('modules without public observations can omit their projectors', () => {
  for (const publicOwner of [undefined, 'Core', 'Elite']) {
    const modules = ['Core', 'Elite'].map((id) =>
      defineNativeModule({
        id,
        data: {},
        state: {
          create: () => ({ [id + 'Private']: { value: id } }),
          ...(id === publicOwner
            ? {
                project: ({ profession }) => ({
                  [id]: (id === 'Core' ? profession.core : profession.specialization.state)[id + 'Private']
                })
              }
            : {})
        }
      })
    );
    const family = defineNativeProfession({ id: 'optional-projection', name: 'Optional projection', modules });
    const profession = family.runtimeFor({ specialization: 'Elite' }).createState({});
    assert.deepEqual(projectObservedState(family, { profession }), {
      ...(publicOwner ? { [publicOwner]: { value: publicOwner } } : {}),
      [SHARED_STATE_IDS.AVAILABLE_FLIPS]: {},
      [SHARED_STATE_IDS.AUTOATTACK_CHAINS]: {}
    });
  }
});
