import assert from 'node:assert/strict';
import test from 'node:test';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

// Complete callbacks keep these tests about declaration admission rather than live resource tuning.
const energy = {
  kind: 'continuous',
  state: (context) => context.profession.core.energy,
  maximum: () => 10,
  initial: () => 5,
  recovery: () => 1
};

function family(hooks = {}, create = () => ({ energy: createResourceClock() })) {
  return defineNativeProfession({
    id: 'policy-fixture',
    name: 'Policy fixture',
    modules: [defineNativeModule({ id: 'Core', data: {}, state: { create }, hooks })]
  });
}

// Native previews and direct execution must reject the same malformed declarations before creating live state.
for (const [name, hooks, error] of [
  ['incomplete resource', { resources: { energy: { kind: 'continuous' } } }, /Resource policies require.*energy/],
  ['invalid kind', { resources: { energy: { ...energy, kind: 'invalid' } } }, /Resource policies require.*energy/],
  ['unknown resource', { resources: { enregy: energy } }, /Unknown resource policy: enregy/],
  ['incomplete endurance', { endurance: {} }, /Endurance requires/]
]) {
  test(`${name} fails in native composition and direct runtime overrides`, () => {
    let created = 0;
    const create = () => {
      created += 1;

      return {};
    };

    const native = family(hooks, create);
    assert.throws(() => native.runtimeFor({}), error);
    assert.throws(() => native.runtimeFor({}, { traitTriggers: false }), error);
    const valid = family({}, create).runtimeFor({});
    assert.throws(() => runGw2Runtime({ profession: { ...valid, ...hooks }, rotation: [] }), error);
    assert.equal(created, 0);
  });
}

// The selected elite's complete policy replaces Core's policy, and absent capabilities do not allocate a pool.
test('policy composition preserves elite overrides and optional absent pools', () => {
  const eliteEnergy = { ...energy, maximum: () => 20 };
  const profession = defineNativeProfession({
    id: 'selected-policy',
    name: 'Selected policy',
    modules: [
      defineNativeModule({
        id: 'Core',
        data: {},
        state: { create: () => ({ energy: createResourceClock() }) },
        hooks: { resources: { energy, heat: undefined } }
      }),
      defineNativeModule({
        id: 'Elite',
        data: {},
        state: { create: () => ({}) },
        hooks: { resources: { energy: eliteEnergy } }
      })
    ]
  });
  assert.equal(profession.runtimeFor({}).resources.energy, energy);
  const runtime = profession.runtimeFor({ specialization: 'Elite' });
  assert.equal(runtime.resources.energy, eliteEnergy);
  const result = runGw2Runtime({ profession: runtime, rotation: [] });
  assert.deepEqual(result.warnings, []);
});

// Fixture overrides follow the executable hook contract instead of a separate normalized-policy container.
test('fixture runtime policies receive the same validation', () => {
  const fixture = defineTestProfession({
    id: 'invalid-fixture',
    name: 'Invalid fixture',
    hooks: { resources: { energy: { ...energy, recovery: null } } }
  });
  assert.throws(() => fixture.runtimeFor(), /Resource policies require.*energy/);
});
